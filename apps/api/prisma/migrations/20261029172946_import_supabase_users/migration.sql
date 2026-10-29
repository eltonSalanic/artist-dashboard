-- Copies every Supabase Auth account into Better Auth's tables, keeping its id
-- (which is already the app's User.id) and its bcrypt password hash, so people
-- sign in with the password they already have. better-auth.ts verifies `$2…`
-- hashes with bcrypt.
--
-- Only runs where Supabase's `auth.users` exists: a Supabase database, local or
-- hosted. Prisma's shadow database has no `auth` schema and skips it. Accounts
-- that already exist in Better Auth (same id or email) are left alone, so it is
-- safe after people have started signing up.
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "AuthUser" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
  SELECT
    u.id::text,
    COALESCE(app."displayName", split_part(u.email, '@', 1)),
    lower(u.email),
    u.email_confirmed_at IS NOT NULL,
    u.created_at,
    now()
  FROM auth.users u
  LEFT JOIN "User" app ON app.id = u.id
  WHERE u.email IS NOT NULL
    AND u.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "AuthUser" a
      WHERE a.id = u.id::text OR a.email = lower(u.email)
    );

  -- One "credential" account per imported user holds the password. Invited
  -- people who never set one get none, and join with an invite code as usual.
  INSERT INTO "AuthAccount" ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
  SELECT
    gen_random_uuid()::text,
    u.id::text,
    'credential',
    u.id::text,
    u.encrypted_password,
    u.created_at,
    now()
  FROM auth.users u
  JOIN "AuthUser" a ON a.id = u.id::text
  WHERE COALESCE(u.encrypted_password, '') <> ''
    AND NOT EXISTS (
      SELECT 1 FROM "AuthAccount" x
      WHERE x."userId" = a.id AND x."providerId" = 'credential'
    );
END $$;
