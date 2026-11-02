-- Every table is served only by the authenticated Nest API, never Supabase's
-- public Data API. Until now only the sign-in, billing and ItemLink tables
-- said so; the rest relied on the project not granting the Data API roles
-- anything, which older Supabase projects do by default for new tables.
--
-- Two locks, either of which is enough on its own:
-- 1. RLS on with no policies: the anon and authenticated roles see no rows.
--    The API connects as the tables' owner, which RLS doesn't apply to.
-- 2. No privileges for those roles on what exists now, or on tables later
--    migrations create, so a new model is closed even if its migration
--    forgets line 1. (Still add it: see CLAUDE.md.)
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  -- The roles only exist on Supabase; Prisma's shadow database has neither.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
