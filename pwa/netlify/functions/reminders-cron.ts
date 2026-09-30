import type { Config, Context } from '@netlify/functions';
import { canUseData } from '../lib/deploy';
import { cleanup, dispatchDueReminders, remindersMayBeDue } from '../lib/reminders';

// Runs every minute on published deploys (locally: `npx netlify-cli functions:invoke reminders-cron`).
// The database is only touched when a reminder is due, once an hour as a safety net, and for the
// daily cleanup, so Neon can scale to zero the rest of the time.
export default async (_req: Request, context: Context) => {
  if (!canUseData(context)) return; // never from a preview (they share the production database)
  const now = new Date();
  const topOfHour = now.getUTCMinutes() === 0;
  if (topOfHour || (await remindersMayBeDue(now))) {
    const sent = await dispatchDueReminders();
    if (sent) console.log(`[reminders] delivered ${sent}`);
  }
  if (topOfHour && now.getUTCHours() === 3) await cleanup();
};

export const config: Config = {
  schedule: '* * * * *',
};
