-- Reliable reminder delivery: a reminder is claimed while being sent and only marked
-- as sent once push or e-mail succeeded; failed deliveries are retried a few times.
ALTER TABLE reminders
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN attempts   integer NOT NULL DEFAULT 0;
