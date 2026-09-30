-- Bonsai Chef — initial schema

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- One-time login codes (only an HMAC of the code is stored).
CREATE TABLE login_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  code_hash  text NOT NULL,
  ip         text,
  attempts   integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX login_codes_email_idx ON login_codes (email, created_at DESC);
CREATE INDEX login_codes_ip_idx ON login_codes (ip, created_at DESC);

-- Sessions (only a SHA-256 of the cookie token is stored).
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE bonsai (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN ('esterno', 'interno')),
  substrate  text NOT NULL DEFAULT '',
  pot        text NOT NULL DEFAULT '',
  -- { repotting, pruning, shootCutting, wiring, defoliation, fertilizing }
  care       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bonsai_user_idx ON bonsai (user_id, created_at);

CREATE TABLE tools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('substrato', 'attrezzo', 'accessorio')),
  genre      text NOT NULL DEFAULT '',
  seller     text NOT NULL DEFAULT '',
  price      text NOT NULL DEFAULT '',
  links      text NOT NULL DEFAULT '',
  details    text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tools_user_idx ON tools (user_id, created_at);

-- Photo metadata; the image itself lives in Netlify Blobs under "<user_id>/<id>".
-- A photo with neither bonsai_id nor tool_id is "unattached": freshly uploaded or
-- removed from its record. Unattached photos are purged by the scheduled function.
CREATE TABLE photos (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonsai_id    uuid REFERENCES bonsai (id) ON DELETE SET NULL,
  tool_id      uuid REFERENCES tools (id) ON DELETE SET NULL,
  position     integer NOT NULL DEFAULT 0,
  content_type text NOT NULL,
  byte_size    integer NOT NULL,
  width        integer,
  height       integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (bonsai_id IS NULL OR tool_id IS NULL)
);
CREATE INDEX photos_user_idx ON photos (user_id);
CREATE INDEX photos_bonsai_idx ON photos (bonsai_id, position) WHERE bonsai_id IS NOT NULL;
CREATE INDEX photos_tool_idx ON photos (tool_id, position) WHERE tool_id IS NOT NULL;
CREATE INDEX photos_unattached_idx ON photos (created_at) WHERE bonsai_id IS NULL AND tool_id IS NULL;

CREATE TABLE reminders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonsai_id  uuid NOT NULL REFERENCES bonsai (id) ON DELETE CASCADE,
  message    text NOT NULL,
  remind_at  timestamptz NOT NULL,
  sent_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminders_due_idx ON reminders (remind_at) WHERE sent_at IS NULL;
CREATE INDEX reminders_bonsai_idx ON reminders (bonsai_id);

CREATE TABLE push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);
