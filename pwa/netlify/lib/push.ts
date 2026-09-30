import webpush from 'web-push';
import { requireUser } from './auth';
import { getDb } from './db';
import { HttpError, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { pushSubscriptionSchema } from './schemas';
import { z } from 'zod';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  // Apple and Google require a mailto: or https: contact.
  const siteUrl = process.env.URL ?? '';
  const subject = process.env.VAPID_SUBJECT || (siteUrl.startsWith('https://') ? siteUrl : 'mailto:bonsai-chef@example.com');
  return { publicKey, privateKey, subject };
}

/** Sends a notification to every device of the user; returns how many accepted it. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const details = vapid();
  if (!details) return 0;
  const db = await getDb();
  const subs = await db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 24 * 60 * 60,
          urgency: 'normal',
          vapidDetails: details,
        });
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The browser dropped this subscription (app uninstalled, permission revoked…).
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
        } else {
          console.error('[push] delivery failed', status, (err as Error).message);
        }
      }
    }),
  );
  return delivered;
}

export async function publicKey(): Promise<Response> {
  const details = vapid();
  if (!details) throw new HttpError(503, 'Le notifiche push non sono configurate sul server.');
  return json({ publicKey: details.publicKey }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}

export async function subscribe({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const sub = parseInput(pushSubscriptionSchema, await readJson(req));
  const db = await getDb();
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
    [user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, req.headers.get('User-Agent')?.slice(0, 300) ?? null],
  );
  return noContent();
}

export async function unsubscribe({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const { endpoint } = parseInput(z.object({ endpoint: z.string().max(1000) }), await readJson(req));
  const db = await getDb();
  await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, user.id]);
  return noContent();
}

export async function sendTest({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const delivered = await sendPushToUser(user.id, {
    title: 'Bonsai Chef',
    body: 'Le notifiche funzionano! Riceverai qui i tuoi promemoria. 🌳',
    url: '/',
    tag: 'test',
  });
  if (!delivered) throw new HttpError(409, 'Nessun dispositivo registrato per le notifiche.');
  return json({ delivered });
}
