CREATE TABLE IF NOT EXISTS auth_provider_settings (
  provider varchar(40) PRIMARY KEY,
  display_name varchar(80) NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  client_id text,
  client_secret_encrypted jsonb,
  redirect_uri text,
  scopes text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'auth_provider_settings_set_updated_at'
  ) THEN
    CREATE TRIGGER auth_provider_settings_set_updated_at
    BEFORE UPDATE ON auth_provider_settings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

INSERT INTO auth_provider_settings (provider, display_name, enabled, scopes)
VALUES ('github', 'GitHub', false, ARRAY['read:user', 'user:email'])
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL,
  provider_user_id varchar(160) NOT NULL,
  provider_username varchar(160),
  provider_email varchar(254),
  avatar_url text,
  profile_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_oauth_accounts_provider_user_unique
ON user_oauth_accounts (provider, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_oauth_accounts_provider_user_id_unique
ON user_oauth_accounts (provider, provider_user_id);

CREATE INDEX IF NOT EXISTS user_oauth_accounts_user_id_idx
ON user_oauth_accounts (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'user_oauth_accounts_set_updated_at'
  ) THEN
    CREATE TRIGGER user_oauth_accounts_set_updated_at
    BEFORE UPDATE ON user_oauth_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS oauth_login_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(40) NOT NULL,
  state_hash text NOT NULL,
  code_verifier text NOT NULL,
  return_to text NOT NULL DEFAULT '/login',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS oauth_login_states_hash_unique
ON oauth_login_states (state_hash);

CREATE INDEX IF NOT EXISTS oauth_login_states_expires_at_idx
ON oauth_login_states (expires_at);

CREATE TABLE IF NOT EXISTS oauth_login_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(40) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticket_hash text NOT NULL,
  return_to text NOT NULL DEFAULT '/login',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS oauth_login_tickets_hash_unique
ON oauth_login_tickets (ticket_hash);

CREATE INDEX IF NOT EXISTS oauth_login_tickets_user_id_idx
ON oauth_login_tickets (user_id);

CREATE INDEX IF NOT EXISTS oauth_login_tickets_expires_at_idx
ON oauth_login_tickets (expires_at);
