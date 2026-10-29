-- Sign-in tables hold password hashes and session tokens. Like ItemLink, they
-- are served only by the authenticated Nest API, never Supabase's public Data
-- API: RLS on with no policies means the anon and authenticated roles see nothing.
ALTER TABLE "AuthUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthVerification" ENABLE ROW LEVEL SECURITY;
