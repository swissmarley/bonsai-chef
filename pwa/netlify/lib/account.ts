// Info page contact form and the one-time "Novità" announcements.
import { requireUser } from './auth';
import { getDb } from './db';
import { feedbackEmail, isDev, sendEmail } from './email';
import { HttpError, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { feedbackSchema } from './schemas';

const MAX_FEEDBACK_PER_HOUR = 5;

/** Sends a tester's message to the developer (FEEDBACK_EMAIL), who can reply directly to the tester. */
export async function sendFeedback({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const { message } = parseInput(feedbackSchema, await readJson(req));
  const to = process.env.FEEDBACK_EMAIL?.trim();
  if (!to && !isDev()) {
    console.error('[feedback] FEEDBACK_EMAIL is not set');
    throw new HttpError(503, 'Il modulo di contatto non è ancora attivo. Riprova più tardi.');
  }
  const db = await getDb();
  // The message is stored first: it also counts towards the limit, and is not lost if the e-mail fails.
  const [row] = await db.query<{ id: string }>(
    `INSERT INTO feedback_messages (user_id, message)
     SELECT $1, $2
      WHERE (SELECT count(*) FROM feedback_messages WHERE user_id = $1 AND created_at > now() - interval '1 hour') < $3
     RETURNING id`,
    [user.id, message, MAX_FEEDBACK_PER_HOUR],
  );
  if (!row) throw new HttpError(429, 'Hai già inviato diversi messaggi: riprova tra un’ora.');
  await sendEmail(feedbackEmail(to || 'sviluppatore@localhost', user.email, message));
  await db.query('UPDATE feedback_messages SET sent_at = now() WHERE id = $1', [row.id]);
  return noContent();
}

const ANNOUNCEMENT_KEY = /^[a-z0-9-]{1,40}$/;

export async function listAnnouncements({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const db = await getDb();
  const rows = await db.query<{ key: string }>('SELECT key FROM seen_announcements WHERE user_id = $1', [user.id]);
  return json({ seen: rows.map((r) => r.key) });
}

/** Once dismissed, an announcement never shows again for this account, on any device. */
export async function markAnnouncementSeen({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!ANNOUNCEMENT_KEY.test(params.key)) throw new HttpError(404, 'Avviso non trovato.');
  const db = await getDb();
  await db.query('INSERT INTO seen_announcements (user_id, key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, params.key]);
  return noContent();
}
