-- ============================================================
-- FILE: supabase/008_trust.sql
-- Phase 4: trust levels, badges, monthly employer leaderboards.
--   Levels: 0 New · 1 Verified · 2 Reliable · 3 Proven · 4 Trusted
--   Earned only from recorded events; recomputed hourly, so they go DOWN
--   as well as up. Admin overrides are logged in trust_audit.
--   Badges are permanent once earned. Leaderboards exclude any company
--   with a ghosting penalty or suspension.
-- Run AFTER 007_freelance_trust.sql. Safe to re-run.
-- ============================================================

alter table public.users
  add column if not exists trust_level smallint not null default 0,
  add column if not exists trust_override smallint;
alter table public.companies
  add column if not exists trust_level smallint not null default 0,
  add column if not exists trust_override smallint;
alter table public.projects add column if not exists client_trust smallint not null default 0;
do $$ begin
  alter table public.users add constraint users_trust_check check (trust_level between 0 and 4 and (trust_override is null or trust_override between 0 and 4));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.companies add constraint companies_trust_check check (trust_level between 0 and 4 and (trust_override is null or trust_override between 0 and 4));
exception when duplicate_object then null; end $$;
create index if not exists projects_trust_idx on public.projects (status, client_trust desc, last_activity_at desc);

create table if not exists public.badges_earned (
  subject_type text not null check (subject_type in ('user', 'company')),
  subject_id uuid not null,
  badge_key text not null check (badge_key ~ '^[a-z0-9_]{2,40}$'),
  earned_at timestamptz not null default now(),
  primary key (subject_type, subject_id, badge_key)
);

create table if not exists public.trust_audit (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'company')),
  subject_id uuid not null,
  admin_id uuid references public.users (id) on delete set null,
  old_override smallint,
  new_override smallint,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
create index if not exists trust_audit_created_idx on public.trust_audit (created_at desc);

create table if not exists public.leaderboard_snapshots (
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  board text not null check (board in ('responsive', 'verified_hires')),
  rank smallint not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  value numeric(8, 2) not null,
  sample integer not null,
  primary key (month, board, rank)
);

-- ── Live leaderboard for a month (UTC) ───────────────────────
-- responsive: share of that month's applications answered within 7 days
--   (needs 5+ applications that are at least 7 days old).
-- verified_hires: hires confirmed by the hired person in that month.
create or replace function public.leaderboard_rows(p_month text)
returns table (board text, rank bigint, company_id uuid, value numeric, sample bigint)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select ((p_month || '-01')::date)::timestamp at time zone 'utc' as s,
           (((p_month || '-01')::date) + interval '1 month')::timestamp at time zone 'utc' as e
  ), eligible as (
    select id from public.companies where verification_status = 'verified' and not suspended and penalty_level = 0
  ), resp as (
    select j.company_id,
      count(*) as n,
      round(100.0 * count(*) filter (where a.first_response_at <= a.created_at + interval '7 days') / count(*), 1) as pct
    from public.job_applications a
    join public.jobs j on j.id = a.job_id
    join eligible c on c.id = j.company_id, bounds b
    where a.created_at >= b.s and a.created_at < b.e and a.created_at < now() - interval '7 days'
    group by j.company_id
    having count(*) >= 5
  ), hires as (
    select j.company_id, count(*) as n
    from public.job_applications a
    join public.jobs j on j.id = a.job_id
    join eligible c on c.id = j.company_id, bounds b
    where a.hire_confirmed is true and a.hire_confirmed_at >= b.s and a.hire_confirmed_at < b.e
    group by j.company_id
  )
  select 'responsive', row_number() over (order by pct desc, n desc), company_id, pct, n from resp
  union all
  select 'verified_hires', row_number() over (order by n desc), company_id, n, n from hires;
$$;

-- Freeze last month once (called by the backend; idempotent).
create or replace function public.snapshot_leaderboards()
returns void
language plpgsql
set search_path = public
as $$
declare v_month text := to_char((now() at time zone 'utc') - interval '1 month', 'YYYY-MM');
begin
  if exists (select 1 from public.leaderboard_snapshots where month = v_month) then return; end if;
  insert into public.leaderboard_snapshots (month, board, rank, company_id, value, sample)
  select v_month, board, rank, company_id, value, sample from public.leaderboard_rows(v_month) where rank <= 25;
end $$;

-- ── Levels + badges ──────────────────────────────────────────
create or replace function public.refresh_trust()
returns void
language plpgsql
set search_path = public
as $$
begin
  -- Freelancers
  with f as (
    select u.id,
      exists (select 1 from public.freelancer_profiles p where p.user_id = u.id) as has_profile,
      (select count(*) from public.contracts c where c.freelancer_id = u.id and c.status = 'completed') as done,
      (select count(*) from public.milestones m join public.contracts c on c.id = m.contract_id where c.freelancer_id = u.id and m.status = 'approved') as approved,
      (select count(*) from public.milestones m join public.contracts c on c.id = m.contract_id where c.freelancer_id = u.id and m.status = 'approved' and m.due_date is not null and m.submitted_at::date > m.due_date) as late,
      (select avg(rating) from public.freelance_reviews r where r.reviewee_id = u.id) as rating,
      (select count(*) from public.contracts c where c.freelancer_id = u.id and c.status = 'cancelled' and c.cancelled_by = u.id and c.updated_at > now() - interval '90 days') as quits,
      (select count(*) from public.verified_work w where w.freelancer_id = u.id and w.status = 'verified') as vwork
    from public.users u where u.role = 'freelancer'
  ), lv as (
    select id, case
      when done >= 15 and coalesce(rating, 0) >= 4.6 and quits = 0 and late * 10 <= approved then 4
      when done + vwork >= 5 and coalesce(rating, 0) >= 4.3 and quits = 0 then 3
      when approved >= 3 and late * 4 <= approved then 2
      when has_profile then 1
      else 0 end as lvl
    from f
  )
  update public.users u set trust_level = coalesce(u.trust_override, lv.lvl)
  from lv where u.id = lv.id and u.trust_level is distinct from coalesce(u.trust_override, lv.lvl);

  -- Clients
  with c as (
    select u.id,
      (select count(*) from public.contracts k where k.client_id = u.id and k.status = 'completed') as done,
      (select avg(rating) from public.freelance_reviews r where r.reviewee_id = u.id) as rating,
      (select count(*) from public.projects p where p.client_id = u.id and p.status <> 'draft') as posted
    from public.users u where u.role = 'client'
  ), lv as (
    select id, case
      when done >= 10 and coalesce(rating, 0) >= 4.5 then 4
      when done >= 3 and coalesce(rating, 0) >= 4.2 then 3
      when done >= 1 then 2
      when posted >= 1 then 1
      else 0 end as lvl
    from c
  )
  update public.users u set trust_level = coalesce(u.trust_override, lv.lvl)
  from lv where u.id = lv.id and u.trust_level is distinct from coalesce(u.trust_override, lv.lvl);

  update public.projects p set client_trust = u.trust_level
  from public.users u where u.id = p.client_id and p.client_trust is distinct from u.trust_level;

  -- Companies
  with k as (
    select c.id, c.verification_status = 'verified' as verified, c.penalty_level,
      s.opened_pct, s.replied_7d_pct, coalesce(s.hires_verified, 0) as hires, coalesce(s.ghost_jobs_90d, 0) as ghost
    from public.companies c left join public.company_scores s on s.company_id = c.id
  ), lv as (
    select id, case
      when not verified then 0
      when penalty_level > 0 or ghost > 0 then 1
      when coalesce(replied_7d_pct, 0) >= 85 and coalesce(opened_pct, 0) >= 90 and hires >= 3 then 4
      when coalesce(replied_7d_pct, 0) >= 70 and hires >= 1 then 3
      when coalesce(replied_7d_pct, 0) >= 60 and coalesce(opened_pct, 0) >= 70 then 2
      else 1 end as lvl
    from k
  )
  update public.companies c set trust_level = coalesce(c.trust_override, lv.lvl)
  from lv where c.id = lv.id and c.trust_level is distinct from coalesce(c.trust_override, lv.lvl);

  -- Badges (permanent). Company:
  insert into public.badges_earned (subject_type, subject_id, badge_key)
  select 'company', company_id, b from (
    select company_id, 'first_verified_hire' as b from public.company_scores where hires_verified >= 1
    union all select company_id, 'ten_verified_hires' from public.company_scores where hires_verified >= 10
    union all select company_id, 'opens_every_cv' from public.company_scores where applications >= 10 and opened_pct = 100
    union all select company_id, 'answers_everyone' from public.company_scores where matured >= 10 and no_response_pct = 0
  ) x on conflict do nothing;

  -- Freelancers:
  insert into public.badges_earned (subject_type, subject_id, badge_key)
  select 'user', uid, b from (
    select freelancer_id as uid, 'first_contract' as b from public.contracts where status = 'completed'
    union all
    select c.freelancer_id, 'zero_late' from public.milestones m join public.contracts c on c.id = m.contract_id
      where m.status = 'approved' group by c.freelancer_id
      having count(*) >= 5 and count(*) filter (where m.due_date is not null and m.submitted_at::date > m.due_date) = 0
    union all
    select reviewee_id, 'five_star' from public.freelance_reviews r join public.users u on u.id = r.reviewee_id and u.role = 'freelancer'
      group by reviewee_id having count(*) >= 3 and min(rating) = 5
    union all
    select freelancer_id, 'verified_five' from public.verified_work where status = 'verified' group by freelancer_id having count(*) >= 5
    -- Clients:
    union all select client_id, 'first_hire' from public.contracts
    union all
    select c.client_id, 'fast_approver' from public.milestones m join public.contracts c on c.id = m.contract_id
      where m.status = 'approved' and m.approved_at <= m.submitted_at + interval '3 days' group by c.client_id having count(*) >= 5
    union all
    select client_id, 'repeat_client' from public.contracts group by client_id, freelancer_id having count(*) >= 2
    -- Job seekers:
    union all select a.user_id, 'first_interview' from public.interviews i join public.job_applications a on a.id = i.application_id where i.candidate_confirmed is true
    union all select user_id, 'hired' from public.job_applications where hire_confirmed is true
    union all select user_id, 'researcher' from public.reports group by user_id having count(*) >= 3
  ) x on conflict do nothing;
end $$;

do $$
declare t text;
begin
  foreach t in array array['badges_earned', 'trust_audit', 'leaderboard_snapshots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on function public.leaderboard_rows(text) from public, anon, authenticated;
revoke all on function public.snapshot_leaderboards() from public, anon, authenticated;
revoke all on function public.refresh_trust() from public, anon, authenticated;
grant execute on function public.leaderboard_rows(text) to service_role;
grant execute on function public.snapshot_leaderboards() to service_role;
grant execute on function public.refresh_trust() to service_role;
