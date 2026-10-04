-- ============================================================
-- FILE: supabase/005_accountability.sql
-- Phase 1: hiring accountability.
--   • CV-opened receipts (first time a recruiter opens an applicant)
--   • auto "no response" after 21 days
--   • jobs must close with an outcome; leftover applicants get an answer
--   • ghost flag on jobs nobody looked at
--   • company_scores: the public Hiring Record (refreshed by the backend)
--   • automatic penalties for repeat ghosting (admin can override)
-- Run AFTER 004_billing.sql. Safe to re-run.
-- ============================================================

alter table public.job_applications
  add column if not exists cv_opened_at timestamptz,
  add column if not exists no_response boolean not null default false;

alter table public.jobs
  add column if not exists outcome text,
  add column if not exists outcome_note text,
  add column if not exists closed_at timestamptz,
  add column if not exists ghost_flag boolean not null default false,
  -- Set when an admin accepts a dispute; the scorer never re-flags that job.
  add column if not exists ghost_cleared boolean not null default false,
  add column if not exists apps_count integer not null default 0,
  add column if not exists opened_count integer not null default 0,
  add column if not exists replied_count integer not null default 0;
do $$ begin
  alter table public.jobs add constraint jobs_outcome_check
    check (outcome is null or outcome in ('hired_here', 'hired_elsewhere', 'not_hired', 'cancelled'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.jobs add constraint jobs_outcome_note_len check (outcome_note is null or char_length(outcome_note) <= 500);
exception when duplicate_object then null; end $$;

alter table public.companies
  add column if not exists penalty_level smallint not null default 0,
  add column if not exists penalty_source text,
  add column if not exists penalty_reason text,
  add column if not exists suspended boolean not null default false;
do $$ begin
  alter table public.companies add constraint companies_penalty_check check (penalty_level between 0 and 3);
exception when duplicate_object then null; end $$;

create table if not exists public.company_scores (
  company_id uuid primary key references public.companies (id) on delete cascade,
  applications integer not null default 0,
  matured integer not null default 0,
  opened_pct smallint,
  replied_7d_pct smallint,
  no_response_pct smallint,
  ghost_jobs_90d integer not null default 0,
  closed_jobs integer not null default 0,
  hires_here integer not null default 0,
  interviews_confirmed integer not null default 0,
  hires_verified integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists job_applications_noresp_idx on public.job_applications (created_at) where first_response_at is null and no_response = false;

-- ── Recompute per-job counters, ghost flags, company scores, auto penalties ──
-- Percentages need at least 5 applications so one applicant can't swing them.
create or replace function public.refresh_accountability()
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.jobs j set
    apps_count = s.apps,
    opened_count = s.opened,
    replied_count = s.replied,
    ghost_flag = s.ghost
  from (
    select j2.id,
      count(a.id)::int as apps,
      count(a.cv_opened_at)::int as opened,
      count(a.first_response_at)::int as replied,
      (not j2.ghost_cleared and count(a.id) >= 3 and count(a.cv_opened_at) = 0 and (j2.status = 'closed' or j2.created_at < now() - interval '14 days')) as ghost
    from public.jobs j2
    left join public.job_applications a on a.job_id = j2.id
    group by j2.id
  ) s
  where j.id = s.id
    and (j.apps_count, j.opened_count, j.replied_count, j.ghost_flag) is distinct from (s.apps, s.opened, s.replied, s.ghost);

  insert into public.company_scores as cs (company_id, applications, matured, opened_pct, replied_7d_pct, no_response_pct, ghost_jobs_90d, closed_jobs, hires_here, updated_at)
  select c.id,
    coalesce(a.apps, 0),
    coalesce(a.matured, 0),
    case when coalesce(a.apps, 0) >= 5 then round(100.0 * a.opened / a.apps) end,
    case when coalesce(a.matured, 0) >= 5 then round(100.0 * a.replied7 / a.matured) end,
    case when coalesce(a.matured, 0) >= 5 then round(100.0 * a.noresp / a.matured) end,
    coalesce(jj.ghost90, 0),
    coalesce(jj.closed, 0),
    coalesce(jj.hired, 0),
    now()
  from public.companies c
  left join (
    select j.company_id,
      count(*) as apps,
      count(*) filter (where ja.cv_opened_at is not null) as opened,
      count(*) filter (where ja.created_at < now() - interval '7 days') as matured,
      count(*) filter (where ja.created_at < now() - interval '7 days' and ja.first_response_at <= ja.created_at + interval '7 days') as replied7,
      count(*) filter (where ja.created_at < now() - interval '7 days' and ja.no_response) as noresp
    from public.job_applications ja
    join public.jobs j on j.id = ja.job_id
    group by j.company_id
  ) a on a.company_id = c.id
  left join (
    select company_id,
      count(*) filter (where ghost_flag and coalesce(closed_at, last_activity_at) > now() - interval '90 days') as ghost90,
      count(*) filter (where status = 'closed') as closed,
      count(*) filter (where outcome = 'hired_here') as hired
    from public.jobs
    group by company_id
  ) jj on jj.company_id = c.id
  where c.verification_status = 'verified' or a.apps is not null
  on conflict (company_id) do update set
    applications = excluded.applications,
    matured = excluded.matured,
    opened_pct = excluded.opened_pct,
    replied_7d_pct = excluded.replied_7d_pct,
    no_response_pct = excluded.no_response_pct,
    ghost_jobs_90d = excluded.ghost_jobs_90d,
    closed_jobs = excluded.closed_jobs,
    hires_here = excluded.hires_here,
    updated_at = now();

  -- Automatic penalties follow the 90-day ghost count up AND down.
  -- Admin-set penalties (penalty_source = 'admin') are never touched here.
  update public.companies c set
    penalty_level = n.lvl,
    penalty_source = case when n.lvl = 0 then null else 'auto' end,
    penalty_reason = case when n.lvl = 0 then null else n.ghost || ' jobs in the last 90 days had applicants but no CV was opened.' end
  from (
    select company_id, ghost_jobs_90d as ghost,
      case when ghost_jobs_90d >= 4 then 2 when ghost_jobs_90d >= 2 then 1 else 0 end as lvl
    from public.company_scores
  ) n
  where c.id = n.company_id
    and coalesce(c.penalty_source, 'auto') = 'auto'
    and c.penalty_level is distinct from n.lvl;
end $$;

-- ── Atomic: close a job with an outcome ─────────────────────
-- Everyone still in an open stage gets a final answer (Not selected), the
-- hired applicant (if any) moves to Hired. Returns the changed applications
-- so the backend can notify people and update their trackers.
create or replace function public.close_job(p_job uuid, p_company uuid, p_user uuid, p_outcome text, p_note text, p_hired uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_job public.jobs;
  v_changed jsonb;
begin
  select * into v_job from public.jobs where id = p_job for update;
  if not found or v_job.company_id <> p_company then raise exception 'NOT_FOUND'; end if;
  if v_job.status = 'closed' then raise exception 'ALREADY_CLOSED'; end if;
  if p_outcome not in ('hired_here', 'hired_elsewhere', 'not_hired', 'cancelled') then raise exception 'BAD_OUTCOME'; end if;
  if p_outcome = 'hired_here' then
    if p_hired is null or not exists (select 1 from public.job_applications where id = p_hired and job_id = p_job and stage <> 'rejected') then
      raise exception 'HIRED_REQUIRED';
    end if;
  end if;

  with changed as (
    update public.job_applications a
      set stage = case when a.id = p_hired then 'hired' else 'rejected' end,
          stage_changed_at = now(),
          first_response_at = coalesce(a.first_response_at, now())
      where a.job_id = p_job
        and (a.id = p_hired or a.stage in ('applied', 'screening', 'interview', 'offer'))
      returning a.id, a.user_id, a.stage
  ), ev as (
    insert into public.application_events (application_id, stage, changed_by)
    select id, stage, p_user from changed
    returning 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'stage', stage)), '[]'::jsonb) into v_changed from changed;

  update public.jobs
    set status = 'closed', outcome = p_outcome, outcome_note = nullif(left(p_note, 500), ''), closed_at = now(), last_activity_at = now()
    where id = p_job;
  return v_changed;
end $$;

do $$
begin
  alter table public.company_scores enable row level security;
  revoke all on public.company_scores from anon, authenticated;
end $$;
revoke all on function public.refresh_accountability() from public, anon, authenticated;
revoke all on function public.close_job(uuid, uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.refresh_accountability() to service_role;
grant execute on function public.close_job(uuid, uuid, uuid, text, text, uuid) to service_role;
