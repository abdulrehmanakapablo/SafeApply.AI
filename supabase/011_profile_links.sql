-- ============================================================
-- FILE: supabase/011_profile_links.sql
-- Optional GitHub and portfolio links collected at signup.
-- The backend normalises both; these checks are the last line of
-- defence, so nothing but a canonical GitHub profile URL or an https
-- link can ever be stored (no javascript:, data:, http:, etc.).
-- Run AFTER 010_growth.sql. Safe to re-run.
-- ============================================================

alter table public.users
  add column if not exists github_url text,
  add column if not exists portfolio_url text;

do $$ begin
  alter table public.users add constraint users_github_url_check
    check (github_url is null or github_url ~ '^https://github\.com/[A-Za-z0-9](-?[A-Za-z0-9]){0,38}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.users add constraint users_portfolio_url_check
    check (portfolio_url is null or (char_length(portfolio_url) <= 300 and portfolio_url ~ '^https://[A-Za-z0-9.-]+\.[A-Za-z0-9-]+(:[0-9]{1,5})?([/?][^\s]*)?$'));
exception when duplicate_object then null; end $$;
