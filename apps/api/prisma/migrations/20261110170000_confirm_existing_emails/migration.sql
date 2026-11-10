-- Sign-up now requires confirming your email with a code. Everyone who
-- already has an account signed up before that, so count their email as
-- confirmed rather than locking them out at their next sign-in.
UPDATE "AuthUser" SET "emailVerified" = true WHERE "emailVerified" = false;
