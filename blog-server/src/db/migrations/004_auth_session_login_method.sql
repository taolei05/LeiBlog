ALTER TABLE auth_sessions
ADD COLUMN IF NOT EXISTS login_method varchar(40) NOT NULL DEFAULT 'password';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_sessions_login_method_check'
  ) THEN
    ALTER TABLE auth_sessions
    ADD CONSTRAINT auth_sessions_login_method_check
    CHECK (login_method IN ('password', 'oauth'));
  END IF;
END $$;
