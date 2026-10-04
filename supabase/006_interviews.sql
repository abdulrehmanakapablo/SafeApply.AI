-- ============================================================
-- FILE: supabase/006_interviews.sql
-- Phase 2: interview scheduling with two-sided confirmation, and hires
-- that only count once the hired person confirms.
-- Run AFTER 005_accountability.sql. Safe to re-run.
-- ============================================================

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  mode text not null check (mode in ('video', 'phone', 'onsite')),
  duration_min smallint not null default 30 check (duration_min between 15 and 240),
  location text check (location is null or char_length(location) <= 300),
  note text check (note is null or char_length(note) <= 1000),
  video_url text check (video_url is null or video_url ~ '^https://meet\.jit\.si/'),
  status text not null default 'proposed' check (status in ('proposed', 'scheduled', 'reschedule_requested', 'cancelled')),
  scheduled_at timestamptz,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  cancelled_by text check (cancelled_by is null or cancelled_by in ('company', 'candidate')),
  candidate_note text check (candidate_note is null or char_length(candidate_note) <= 500),
  -- Two-sided confirmation that it actually happened.
  company_confirmed boolean,
  candidate_confirmed boolean,
  reminder_sent_at timestamptz,
  confirm_asked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'scheduled' or scheduled_at is not null)
);
create index if not exists interviews_app_idx on public.interviews (application_id);
create index if not exists interviews_company_idx on public.interviews (company_id, scheduled_at);
create index if not exists interviews_due_idx on public.interviews (scheduled_at) where status = 'scheduled';

create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  starts_at timestamptz not null,
  unique (interview_id, starts_at)
);

-- Hires count publicly only after the hired person confirms.
alter table public.job_applications
  add column if not exists hire_confirmed boolean,
  add column if not exists hire_confirmed_at timestamptz;

-- Adds confirmed interviews + verified hires to company_scores.
create or replace function public.refresh_interview_scores()
returns void
language sql
set search_path = public
as $$
  update public.company_scores cs set
    interviews_confirmed = coalesce(i.n, 0),
    hires_verified = coalesce(h.n, 0)
  from public.companies c
  left join (
    select company_id, count(*) as n from public.interviews
    where candidate_confirmed is true and company_confirmed is not false
    group by company_id
  ) i on i.company_id = c.id
  left join (
    select j.company_id, count(*) as n
    from public.job_applications a join public.jobs j on j.id = a.job_id
    where a.stage = 'hired' and a.hire_confirmed is true
    group by j.company_id
  ) h on h.company_id = c.id
  where cs.company_id = c.id
    and (cs.interviews_confirmed, cs.hires_verified) is distinct from (coalesce(i.n, 0), coalesce(h.n, 0));
$$;

do $$
declare t text;
begin
  foreach t in array array['interviews', 'interview_slots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on function public.refresh_interview_scores() from public, anon, authenticated;
grant execute on function public.refresh_interview_scores() to service_role;
