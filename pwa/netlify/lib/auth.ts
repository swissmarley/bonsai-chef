import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { User } from '../../shared/model';
import { getDb } from './db';
import { loginCodeEmail, sendEmail } from './email';
import { HttpError, json, msg, noContent, parseInput, readJson, type RouteContext } from './http';

const SESSION_COOKIE = 'bc_session';
const SESSION_DAYS = 90;
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // browsers cap cookies at 400 days; the DB expiry is what counts
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const MAX_ATTEMPTS_PER_DAY = 15;
const RESEND_AFTER_SECONDS = 60;
const MAX_CODES_PER_EMAIL_PER_HOUR = 5;
const MAX_CODES_PER_IP_PER_HOUR = 20;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    console.error('[auth] AUTH_SECRET is missing or shorter than 32 characters');
    throw new HttpError(500, 'Configurazione del server incompleta.');
  }
  return secret;
}

const hashCode = (email: string, code: string) => createHmac('sha256', authSecret()).update(`${email}:${code}`).digest('hex');
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=') || null;
  }
  return null;
}

function sessionCookie(req: Request, token: string, maxAge: number): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function assertAllowed(email: string) {
  const allowed = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(email)) {
    throw new HttpError(403, 'Questo indirizzo email non è autorizzato ad accedere.');
  }
}

const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email(msg('Inserisci un indirizzo email valido.')));
const requestSchema = z.object({ email: emailField });
const verifySchema = z.object({
  email: emailField,
  code: z.string().trim().regex(/^\d{6}$/, msg('Il codice deve essere di 6 cifre.')),
});

export async function requestCode({ req, ip }: RouteContext): Promise<Response> {
  const { email } = parseInput(requestSchema, await readJson(req));
  assertAllowed(email);
  const db = await getDb();

  const [stats] = await db.query<{ per_email: string; per_ip: string; last_sent: Date | null }>(
    `SELECT count(*) FILTER (WHERE email = $1) AS per_email,
            count(*) FILTER (WHERE ip = $2) AS per_ip,
            max(created_at) FILTER (WHERE email = $1) AS last_sent
       FROM login_codes
      WHERE created_at > now() - interval '1 hour' AND (email = $1 OR ip = $2)`,
    [email, ip],
  );
  if (stats.last_sent && Date.now() - new Date(stats.last_sent).getTime() < RESEND_AFTER_SECONDS * 1000) {
    throw new HttpError(429, 'Ti abbiamo appena inviato un codice. Attendi un minuto prima di richiederne un altro.');
  }
  if (Number(stats.per_email) >= MAX_CODES_PER_EMAIL_PER_HOUR || Number(stats.per_ip) >= MAX_CODES_PER_IP_PER_HOUR) {
    throw new HttpError(429, 'Troppe richieste di accesso. Riprova tra qualche minuto.');
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  // The check above gives friendly messages; this transaction enforces the limits atomically.
  // Per-e-mail and per-IP locks serialise concurrent requests (always taken in the same order).
  const [, , [inserted]] = await db.transaction([
    { text: 'SELECT pg_advisory_xact_lock(hashtext($1))', params: [`otp-email:${email}`] },
    { text: 'SELECT pg_advisory_xact_lock(hashtext($1))', params: [`otp-ip:${ip}`] },
    {
      // Older codes are expired rather than deleted so they still count towards the rate limits.
      text: `WITH inserted AS (
               INSERT INTO login_codes (email, code_hash, ip, expires_at)
               SELECT $1, $2, $3, now() + make_interval(mins => $4)
                WHERE NOT EXISTS (SELECT 1 FROM login_codes WHERE email = $1 AND created_at > now() - make_interval(secs => $5))
                  AND (SELECT count(*) FROM login_codes WHERE email = $1 AND created_at > now() - interval '1 hour') < $6
                  AND (SELECT count(*) FROM login_codes WHERE ip = $3 AND created_at > now() - interval '1 hour') < $7
               RETURNING id
             ), expired AS (
               UPDATE login_codes SET expires_at = now()
                WHERE email = $1 AND expires_at > now() AND EXISTS (SELECT 1 FROM inserted)
             )
             SELECT id FROM inserted`,
      params: [
        email,
        hashCode(email, code),
        ip,
        CODE_TTL_MINUTES,
        RESEND_AFTER_SECONDS,
        MAX_CODES_PER_EMAIL_PER_HOUR,
        MAX_CODES_PER_IP_PER_HOUR,
      ],
    },
  ]);
  if (!inserted) throw new HttpError(429, 'Troppe richieste di accesso. Riprova tra qualche minuto.');

  try {
    await sendEmail(loginCodeEmail(email, code, CODE_TTL_MINUTES));
  } catch (err) {
    await db.query('DELETE FROM login_codes WHERE id = $1', [inserted.id]);
    throw err;
  }
  return json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES, resendAfterSeconds: RESEND_AFTER_SECONDS });
}

export async function verifyCode({ req }: RouteContext): Promise<Response> {
  const { email, code } = parseInput(verifySchema, await readJson(req));
  const db = await getDb();

  // Count the attempt before checking it, atomically, so parallel guesses cannot exceed the limit.
  // Besides 5 attempts per code, an address gets at most MAX_ATTEMPTS_PER_DAY guesses in 24 hours.
  const [attempt] = await db.query<{ id: string; code_hash: string; attempts: number }>(
    `UPDATE login_codes SET attempts = attempts + 1
      WHERE id = (SELECT id FROM login_codes WHERE email = $1 AND expires_at > now() ORDER BY created_at DESC LIMIT 1)
        AND attempts < $2
        AND (SELECT coalesce(sum(attempts), 0) FROM login_codes WHERE email = $1 AND created_at > now() - interval '24 hours') < $3
      RETURNING id, code_hash, attempts`,
    [email, MAX_ATTEMPTS, MAX_ATTEMPTS_PER_DAY],
  );
  if (!attempt) {
    const [state] = await db.query<{ live: boolean; today: number }>(
      `SELECT bool_or(expires_at > now()) AS live, coalesce(sum(attempts), 0)::int AS today
         FROM login_codes WHERE email = $1 AND created_at > now() - interval '24 hours'`,
      [email],
    );
    if (state.today >= MAX_ATTEMPTS_PER_DAY) throw new HttpError(429, 'Troppi tentativi di accesso per oggi. Riprova domani.');
    throw state.live
      ? new HttpError(429, 'Troppi tentativi errati. Richiedi un nuovo codice.')
      : new HttpError(400, 'Il codice è scaduto o non è valido. Richiedine uno nuovo.');
  }
  if (!safeEqual(attempt.code_hash, hashCode(email, code))) {
    const left = MAX_ATTEMPTS - attempt.attempts;
    throw new HttpError(
      400,
      left > 0 ? `Codice non corretto. Tentativi rimasti: ${left}.` : 'Codice non corretto. Richiedi un nuovo codice.',
    );
  }

  const token = randomBytes(32).toString('base64url');
  const userAgent = req.headers.get('User-Agent')?.slice(0, 300) ?? null;
  const [, [user]] = await db.transaction([
    { text: 'UPDATE login_codes SET expires_at = now() WHERE email = $1 AND expires_at > now()', params: [email] },
    {
      text: `INSERT INTO users (email, last_login_at) VALUES ($1, now())
             ON CONFLICT (email) DO UPDATE SET last_login_at = now()
             RETURNING id, email`,
      params: [email],
    },
    {
      text: `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent)
             SELECT $1, id, now() + make_interval(days => $3), $4 FROM users WHERE email = $2`,
      params: [hashToken(token), email, SESSION_DAYS, userAgent],
    },
  ]);

  return json(
    { user: { id: String(user.id), email: String(user.email) } satisfies User },
    { headers: { 'Set-Cookie': sessionCookie(req, token, COOKIE_MAX_AGE_SECONDS) } },
  );
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = hashToken(token);
  const db = await getDb();
  const [row] = await db.query<{ id: string; email: string; renew: boolean }>(
    `SELECT u.id, u.email, s.expires_at < now() + make_interval(days => $2 - 1) AS renew
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash, SESSION_DAYS],
  );
  if (!row) return null;
  // Sliding expiry, written at most once a day per session.
  if (row.renew) {
    await db.query('UPDATE sessions SET expires_at = now() + make_interval(days => $2) WHERE token_hash = $1', [tokenHash, SESSION_DAYS]);
  }
  return { id: row.id, email: row.email };
}

export async function requireUser(req: Request): Promise<User> {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, 'Sessione scaduta. Accedi di nuovo.');
  return user;
}

export async function me({ req }: RouteContext): Promise<Response> {
  return json({ user: await requireUser(req) });
}

export async function logout({ req }: RouteContext): Promise<Response> {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const db = await getDb();
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }
  return noContent({ 'Set-Cookie': sessionCookie(req, '', 0) });
}
