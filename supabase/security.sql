-- ============================================================
-- FILE: supabase/security.sql
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- Your backend talks to the database with the service-role key, which
-- bypasses Row Level Security. The anon key, however, is public by design
-- (it ships in every Supabase project URL). With RLS OFF, anyone holding the
-- anon key can read and write your tables directly over the REST API,
-- skipping all of the backend's checks.
--
-- This turns RLS ON for every table in `public` with NO policies, which
-- means: anon/authenticated roles can do nothing; the backend (service
-- role) keeps working exactly as before.
-- ============================================================

-- 1. RLS on every public table
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- 2. No direct table access for the public API roles at all
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- 3. RPC functions (e.g. increment_helpful_count) callable only by the backend
revoke execute on all functions in schema public from anon, authenticated, public;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;
grant execute on all functions in schema public to service_role;

-- 4. Uploaded CVs are private files
update storage.buckets set public = false where id = 'cv-uploads';

-- 5. Check: every row below should say rls_enabled = true
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;
