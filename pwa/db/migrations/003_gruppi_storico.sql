-- Bonsai Chef v2: gruppi, storico interventi, frequenze, concimi, contatti, novità.
-- Additive only (checked by tests/safety.test.ts and rehearsed by scripts/rehearse-migrations.mjs):
-- new tables, new columns that are nullable or have a default, one widened CHECK.
-- Existing rows keep every value they had.

-- Gruppi: user-named collections of bonsai (e.g. "Pini", "Aceri").
CREATE TABLE bonsai_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bonsai_groups_user_idx ON bonsai_groups (user_id, position);

-- A bonsai belongs to at most one group; deleting a group only ungroups its trees.
-- `schedule`: how often each care task is done, { <careKey>: { every, unit, autoReminder } }.
ALTER TABLE bonsai
  ADD COLUMN group_id uuid REFERENCES bonsai_groups (id) ON DELETE SET NULL,
  ADD COLUMN schedule jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX bonsai_group_idx ON bonsai (group_id) WHERE group_id IS NOT NULL;

-- Storico: one row per care task done on a tree (kind = a care key or 'observation').
-- `details`: Rinvaso { mix, pot }, Concimazione { product, form, dose }.
-- `batch_id`: shared by the entries recorded for a whole group at once.
CREATE TABLE care_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonsai_id  uuid NOT NULL REFERENCES bonsai (id) ON DELETE CASCADE,
  kind       text NOT NULL,
  date       date NOT NULL,
  notes      text NOT NULL DEFAULT '',
  details    jsonb NOT NULL DEFAULT '{}'::jsonb,
  batch_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_events_bonsai_idx ON care_events (bonsai_id, date DESC, created_at DESC);
CREATE INDEX care_events_user_idx ON care_events (user_id, created_at DESC);

-- Strumenti used by an entry (substrati of a mix, concimi). The name is kept, so the history
-- stays readable when the catalog item is deleted (the link then becomes NULL).
CREATE TABLE care_event_tools (
  event_id uuid NOT NULL REFERENCES care_events (id) ON DELETE CASCADE,
  position integer NOT NULL,
  tool_id  uuid REFERENCES tools (id) ON DELETE SET NULL,
  name     text NOT NULL,
  PRIMARY KEY (event_id, position)
);
CREATE INDEX care_event_tools_tool_idx ON care_event_tools (tool_id) WHERE tool_id IS NOT NULL;

-- Photos of an entry. They also keep `bonsai_id`, so every version of the app (including an
-- older one after a rollback) sees them as attached and never purges them. Deleting the entry
-- leaves them in the tree's photos.
ALTER TABLE photos
  ADD COLUMN event_id uuid REFERENCES care_events (id) ON DELETE SET NULL;
CREATE INDEX photos_event_idx ON photos (event_id, position) WHERE event_id IS NOT NULL;

-- Reminders created automatically from a care frequency (NULL for the ones set by hand).
ALTER TABLE reminders
  ADD COLUMN care_kind text;

-- New Strumenti category "Concimi": the rule gets wider, every existing row still satisfies it.
ALTER TABLE tools
  DROP CONSTRAINT tools_type_check,
  ADD CONSTRAINT tools_type_check CHECK (type IN ('substrato', 'attrezzo', 'accessorio', 'concime'));

-- Messages sent from the contact form of the Info page (also used for rate limiting).
CREATE TABLE feedback_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at    timestamptz
);
CREATE INDEX feedback_messages_user_idx ON feedback_messages (user_id, created_at DESC);

-- In-app announcements ("Novità") an account has already dismissed.
CREATE TABLE seen_announcements (
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key     text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
