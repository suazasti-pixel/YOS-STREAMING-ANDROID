CREATE TABLE IF NOT EXISTS yos_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS yos_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES yos_users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'YOS Streaming',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
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
