ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_login_method varchar(40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_last_login_method_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_last_login_method_check
    CHECK (
      last_login_method IS NULL
      OR last_login_method IN ('password', 'github', 'google')
    );
  END IF;
END $$;
