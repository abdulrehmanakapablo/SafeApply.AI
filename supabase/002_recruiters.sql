-- ============================================================
-- FILE: supabase/002_recruiters.sql
-- Recruiter portal: companies (verified), members, jobs, applications,
-- messages, notifications, review replies. Run once in the SQL Editor.
-- Safe to re-run. Backend uses the service role; RLS stays ON with no
-- policies so the public anon key can't touch any of this.
-- ============================================================

-- ── Roles: user | recruiter | admin ──────────────────────────
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.users'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.users drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.users add constraint users_role_check check (role in ('user', 'recruiter', 'admin'));

-- ── Companies: profile + verification ────────────────────────
alter table public.companies
  add column if not exists website text,
  add column if not exists domain text,
  add column if not exists about text,
  add column if not exists size text,
  add column if not exists locations text,
  add column if not exists verification_status text not null default 'unverified',
  add column if not exists verification_note text,
  add column if not exists domain_match boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.companies add constraint companies_verification_check
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
exception when duplicate_object then null; end $$;

create index if not exists companies_verification_idx on public.companies (verification_status);

-- One company per recruiter (keeps authorization simple and strict).
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  member_role text not null default 'owner' check (member_role in ('owner', 'recruiter')),
  created_at timestamptz not null default now(),
  unique (user_id)
);
create index if not exists company_members_company_idx on public.company_members (company_id);

-- ── Jobs ─────────────────────────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 100 and 10000),
  location text not null default '' check (char_length(location) <= 120),
  work_mode text not null check (work_mode in ('onsite', 'hybrid', 'remote')),
  employment_type text not null check (employment_type in ('full_time', 'part_time', 'contract', 'internship')),
  salary_min integer not null check (salary_min >= 0),
  salary_max integer not null check (salary_max >= salary_min and salary_max <= 100000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  salary_period text not null default 'year' check (salary_period in ('year', 'month', 'hour')),
  status text not null default 'open' check (status in ('draft', 'open', 'paused', 'closed')),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_company_idx on public.jobs (company_id, status);
create index if not exists jobs_public_idx on public.jobs (status, last_activity_at desc);

-- ── Applications to jobs ─────────────────────────────────────
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  cv_text text not null check (char_length(cv_text) between 100 and 20000),
  cover_note text not null default '' check (char_length(cover_note) <= 2000),
  match_score integer check (match_score between 0 and 100),
  stage text not null default 'applied' check (stage in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  stage_changed_at timestamptz not null default now(),
  first_response_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, user_id)
);
create index if not exists job_applications_job_idx on public.job_applications (job_id, stage);
create index if not exists job_applications_user_idx on public.job_applications (user_id);

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  stage text not null,
  changed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists application_events_app_idx on public.application_events (application_id, created_at);

-- Link a seeker's tracker card to the platform application (auto-sync).
alter table public.applications
  add column if not exists job_application_id uuid references public.job_applications (id) on delete set null;
create unique index if not exists applications_job_application_uidx
  on public.applications (job_application_id) where job_application_id is not null;

-- ── Messages (one thread per application) ────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  sender_id uuid references public.users (id) on delete set null,
  sender_side text not null check (sender_side in ('candidate', 'company')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_app_idx on public.messages (application_id, created_at);

-- ── Notifications ────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null,
  title text not null check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 500),
  link text not null default '' check (link = '' or link like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ── Company replies to reviews (one per review, never deletes the review) ──
create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  body text not null check (char_length(body) between 20 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Lock down: RLS on, no direct access for public API roles ──
do $$
declare t text;
begin
  foreach t in array array['company_members', 'jobs', 'job_applications', 'application_events', 'messages', 'notifications', 'review_replies'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
