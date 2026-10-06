import { getStore } from '@netlify/blobs';
import { CARE_KEYS, type CareKey, type Reminder } from '../../shared/model';
import { requireUser } from './auth';
import { getDb, iso, isoOrNull } from './db';
import { reminderEmail, sendEmail } from './email';
import { HttpError, isUuid, json, noContent, parseInput, readJson, type RouteContext } from './http';
import { purgeAbandonedPhotos } from './photos';
import { sendPushToUser } from './push';
import { reminderSchema } from './schemas';

export interface ReminderRow {
  id: string;
  bonsai_id: string;
  message: string;
  remind_at: Date;
  sent_at: Date | null;
  care_kind: string | null;
  created_at: Date;
}

export const toReminder = (r: ReminderRow): Reminder => ({
  id: r.id,
  bonsaiId: r.bonsai_id,
  message: r.message,
  remindAt: iso(r.remind_at),
  sentAt: isoOrNull(r.sent_at),
  careKind: CARE_KEYS.includes(r.care_kind as CareKey) ? (r.care_kind as CareKey) : null,
  createdAt: iso(r.created_at),
});

export const REMINDER_COLUMNS = 'id, bonsai_id, message, remind_at, sent_at, care_kind, created_at';

/** Pending (not yet delivered) reminders of the user, soonest first. */
export async function listReminders({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const db = await getDb();
  const rows = await db.query<ReminderRow>(
    `SELECT ${REMINDER_COLUMNS} FROM reminders WHERE user_id = $1 AND sent_at IS NULL ORDER BY remind_at`,
    [user.id],
  );
  return json({ reminders: rows.map(toReminder) });
}

export async function createReminder({ req }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  const input = parseInput(reminderSchema, await readJson(req));
  const db = await getDb();
  const [row] = await db.query<ReminderRow>(
    `INSERT INTO reminders (user_id, bonsai_id, message, remind_at)
     SELECT $1, id, $3, $4 FROM bonsai WHERE id = $2 AND user_id = $1
     RETURNING ${REMINDER_COLUMNS}`,
    [user.id, input.bonsaiId, input.message, input.remindAt],
  );
  if (!row) throw new HttpError(404, 'Bonsai non trovato.');
  // Wake the scheduler up for this reminder; if this fails, the hourly check still finds it.
  await refreshNextDue().catch((err) => console.error('[reminders] cannot update next due time', err));
  return json({ reminder: toReminder(row) }, { status: 201 });
}

export async function deleteReminder({ req, params }: RouteContext): Promise<Response> {
  const user = await requireUser(req);
  if (!isUuid(params.id)) throw new HttpError(404, 'Promemoria non trovato.');
  const db = await getDb();
  const rows = await db.query('DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id', [params.id, user.id]);
  if (!rows.length) throw new HttpError(404, 'Promemoria non trovato.');
  return noContent();
}

const siteUrl = () => (process.env.URL || 'http://localhost:8888').replace(/\/$/, '');

const BATCH_SIZE = 20; // keeps one run well inside the 30 s limit of scheduled functions
const MAX_ATTEMPTS = 5;
const CLAIM_TIMEOUT = '5 minutes'; // a claim older than this belongs to a crashed run
const EMAIL_SPACING_MS = 600; // Resend allows 2 requests per second by default

// The time of the next pending reminder is mirrored in Netlify Blobs, so the every-minute
// cron can skip the database entirely and Neon can scale to zero while nothing is due.
const meta = () => getStore({ name: 'meta', consistency: 'strong' });
const NEXT_DUE_KEY = 'reminders-next-due';

export async function refreshNextDue(): Promise<void> {
  const db = await getDb();
  const [row] = await db.query<{ next: Date | null }>('SELECT min(remind_at) AS next FROM reminders WHERE sent_at IS NULL');
  await meta().set(NEXT_DUE_KEY, row?.next ? iso(row.next) : 'none');
}

/** Whether the database must be checked now (unknown state counts as "yes"). */
export async function remindersMayBeDue(now: Date): Promise<boolean> {
  try {
    const value = await meta().get(NEXT_DUE_KEY, { type: 'text' });
    if (value === 'none') return false;
    return !value || Date.parse(value) <= now.getTime();
  } catch (err) {
    console.error('[reminders] cannot read next due time', err);
    return true;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Delivers due reminders: push to all the user's devices, or e-mail when no device accepts it.
 * Each reminder is claimed atomically (overlapping runs never send it twice), marked as sent only
 * after a successful delivery, and released for a retry on failure (up to MAX_ATTEMPTS).
 */
export async function dispatchDueReminders(): Promise<number> {
  const db = await getDb();
  const due = await db.query<{
    id: string;
    user_id: string;
    bonsai_id: string;
    message: string;
    attempts: number;
    bonsai_name: string;
    email: string;
  }>(
    `UPDATE reminders r SET claimed_at = now(), attempts = r.attempts + 1
       FROM bonsai b, users u
      WHERE r.id IN (
              SELECT id FROM reminders
               WHERE sent_at IS NULL AND remind_at <= now()
                 AND (claimed_at IS NULL OR claimed_at < now() - interval '${CLAIM_TIMEOUT}')
               ORDER BY remind_at LIMIT $1
               FOR UPDATE SKIP LOCKED)
        AND b.id = r.bonsai_id AND u.id = r.user_id
      RETURNING r.id, r.user_id, r.bonsai_id, r.message, r.attempts, b.name AS bonsai_name, u.email`,
    [BATCH_SIZE],
  );

  let delivered = 0;
  let emailsSent = 0;
  for (const r of due) {
    const url = `/bonsai/${r.bonsai_id}`;
    try {
      const pushed = await sendPushToUser(r.user_id, {
        title: 'Promemoria Bonsai Chef',
        body: r.message ? `${r.bonsai_name}: ${r.message}` : `È il momento di occuparti di ${r.bonsai_name}.`,
        url,
        tag: `reminder-${r.id}`,
      });
      if (!pushed) {
        if (emailsSent++) await sleep(EMAIL_SPACING_MS);
        await sendEmail(reminderEmail(r.email, r.bonsai_name, r.message, `${siteUrl()}${url}`));
      }
      await db.query('UPDATE reminders SET sent_at = now() WHERE id = $1', [r.id]);
      delivered++;
    } catch (err) {
      const giveUp = r.attempts >= MAX_ATTEMPTS;
      console.error(`[reminders] delivery failed (attempt ${r.attempts}${giveUp ? ', giving up' : ''})`, r.id, err);
      await db.query(
        giveUp ? 'UPDATE reminders SET sent_at = now() WHERE id = $1' : 'UPDATE reminders SET claimed_at = NULL WHERE id = $1',
        [r.id],
      );
    }
  }
  await refreshNextDue();
  return delivered;
}

/** Daily housekeeping: expired codes/sessions, old delivered reminders, abandoned uploads. */
export async function cleanup(): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM login_codes WHERE created_at < now() - interval '1 day'");
  await db.query('DELETE FROM sessions WHERE expires_at < now()');
  await db.query("DELETE FROM reminders WHERE sent_at < now() - interval '30 days'");
  await purgeAbandonedPhotos();
}
