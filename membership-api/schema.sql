CREATE TABLE IF NOT EXISTS yos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yos_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES yos_users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'YOS Streaming',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days BETWEEN 1 AND 366),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yos_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES yos_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS yos_sessions_user_idx ON yos_sessions(user_id);

CREATE TABLE IF NOT EXISTS yos_renewal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES yos_users(id) ON DELETE CASCADE,
  requested_days INTEGER NOT NULL CHECK (requested_days BETWEEN 1 AND 366),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  admin_note TEXT
);
CREATE INDEX IF NOT EXISTS yos_renewals_pending_idx ON yos_renewal_requests(status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS yos_one_pending_renewal_per_user_idx
  ON yos_renewal_requests(user_id) WHERE status = 'pending';

-- Idempotent migration for databases created with membership-api 0.1.0.
ALTER TABLE yos_users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE yos_users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS yos_users_username_idx ON yos_users(lower(username)) WHERE username IS NOT NULL;
ALTER TABLE yos_subscriptions ALTER COLUMN starts_at DROP NOT NULL;
ALTER TABLE yos_subscriptions ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE yos_subscriptions ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
ALTER TABLE yos_subscriptions ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30 CHECK (duration_days BETWEEN 1 AND 366);
UPDATE yos_subscriptions SET activated_at = starts_at WHERE activated_at IS NULL AND starts_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS yos_access_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES yos_users(id) ON DELETE SET NULL,
  identifier TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('login_success', 'login_failed', 'login_suspended', 'login_expired', 'logout', 'admin_update', 'admin_suspend', 'session_revoked')),
  device_id TEXT,
  ip_address INET,
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS yos_access_events_user_time_idx ON yos_access_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS yos_access_events_time_idx ON yos_access_events(created_at DESC);
