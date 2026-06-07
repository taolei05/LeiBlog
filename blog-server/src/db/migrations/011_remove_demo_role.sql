DELETE FROM users
WHERE role = 'demo';

ALTER TABLE users
ALTER COLUMN role DROP DEFAULT;

ALTER TYPE user_role RENAME TO user_role_with_demo;

CREATE TYPE user_role AS ENUM ('admin', 'user');

ALTER TABLE users
ALTER COLUMN role TYPE user_role
USING role::text::user_role;

ALTER TABLE users
ALTER COLUMN role SET DEFAULT 'user'::user_role;

DROP TYPE user_role_with_demo;
