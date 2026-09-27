-- ============================================================
-- FILE: supabase/migrations/20260927000000_init_schema.sql
-- PURPOSE: Initial schema for SafeApply.AI.
-- Reconstructed from every `.from('<table>')` / `.rpc(...)` call in
-- apps/backend/src (controllers + validators) as of 2026-09-27 — there
-- was no existing schema file in the repo.
--
-- Designed to run on a Supabase project (uses auth.users + auth.uid()).
-- On plain Postgres, drop the `references auth.users` lines and the
-- RLS policies that call auth.uid(), or swap in your own auth scheme.
-- ============================================================

-- ─── Extensions ────────────────────────────────────────────
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ─── Helper: keep updated_at current ──────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- users
-- Mirrors the Supabase Auth user (same id). App also keeps its own
-- password_hash / refresh_token_hash as defense-in-depth (see
-- apps/backend/src/controllers/auth.controller.ts).
-- ============================================================
create table users (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  full_name           text not null,
  phone               text,
  password_hash       text not null,
  role                text not null default 'user' check (role in ('user', 'admin')),
  plan                text not null default 'free' check (plan in ('free', 'pro', 'lifetime')),
  banned              boolean not null default false,
  email_verified      boolean not null default false,
  avatar_url          text,
  job_title           text,
  location            text,
  bio                 text,
  cv_text             text,
  notification_prefs  jsonb,
  refresh_token_hash  text,
  last_active         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_users_email on users (email);

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ============================================================
-- companies
-- Aggregates recomputed in app code (reviews.controller.ts
-- updateCompanyAggregates) whenever a review is approved-eligible.
-- ============================================================
create table companies (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  name                    text not null,
  industry                text,
  avg_overall_rating      numeric(3, 1) not null default 0,
  avg_culture_rating      numeric(3, 1) not null default 0,
  avg_interview_rating    numeric(3, 1) not null default 0,
  total_reviews           integer not null default 0,
  created_at              timestamptz not null default now()
);

create index idx_companies_slug on companies (slug);

-- ============================================================
-- reviews
-- reviewer_id is stored for moderation but must never be selected in
-- public-facing queries (see reviews.controller.ts SECURITY comment).
-- ============================================================
create table reviews (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  company_name        text not null,
  reviewer_id         uuid not null references users(id) on delete cascade,
  relationship        text not null check (relationship in ('current_employee', 'former_employee', 'applicant', 'knows_someone')),
  role_type           text not null,
  overall_rating      integer not null check (overall_rating between 1 and 5),
  culture_rating      integer not null check (culture_rating between 1 and 5),
  interview_rating    integer not null check (interview_rating between 1 and 5),
  would_recommend     text not null check (would_recommend in ('yes', 'no', 'maybe')),
  review_text         text not null,
  interview_process   text,
  salary_min          integer check (salary_min is null or salary_min >= 0),
  salary_max          integer check (salary_max is null or salary_max >= 0),
  helpful_count       integer not null default 0,
  moderation_status   text not null default 'pending' check (moderation_status in ('pending', 'approved', 'flagged', 'deleted')),
  created_at          timestamptz not null default now(),
  constraint reviews_salary_range check (
    salary_min is null or salary_max is null or salary_min <= salary_max
  )
);

create index idx_reviews_company_id on reviews (company_id);
create index idx_reviews_moderation_status on reviews (moderation_status);
create index idx_reviews_reviewer_id on reviews (reviewer_id);

-- RPC used by reviews.controller.ts markHelpful()
create or replace function increment_helpful_count(review_id uuid)
returns void as $$
  update reviews set helpful_count = helpful_count + 1 where id = review_id;
$$ language sql;

-- ============================================================
-- applications  (job application tracker)
-- ============================================================
create table applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  company_name  text not null,
  job_title     text not null,
  date_applied  date not null,
  job_link      text,
  salary_min    integer check (salary_min is null or salary_min >= 0),
  salary_max    integer check (salary_max is null or salary_max >= 0),
  location      text,
  status        text not null default 'saved' check (status in ('saved', 'applied', 'screening', 'interviewing', 'offered', 'rejected', 'ghosted')),
  notes         text,
  jd_text       text,
  match_score   integer check (match_score is null or match_score between 0 and 100),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint applications_salary_range check (
    salary_min is null or salary_max is null or salary_min <= salary_max
  )
);

create index idx_applications_user_id on applications (user_id);
create index idx_applications_status on applications (status);

create trigger trg_applications_updated_at
  before update on applications
  for each row execute function set_updated_at();

-- ============================================================
-- application_timeline
-- ============================================================
create table application_timeline (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  status          text not null,
  changed_at      timestamptz not null default now()
);

create index idx_application_timeline_application_id on application_timeline (application_id);

-- ============================================================
-- communication_log
-- ============================================================
create table communication_log (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  type            text not null check (type in ('email', 'call', 'interview', 'follow_up', 'rejection')),
  notes           text not null,
  date            date not null,
  created_at      timestamptz not null default now()
);

create index idx_communication_log_application_id on communication_log (application_id);

-- ============================================================
-- reports  (company intelligence reports)
-- ============================================================
create table reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  company_name  text not null,
  job_title     text,
  jd_text       text,
  report_data   jsonb not null,
  created_at    timestamptz not null default now()
);

create index idx_reports_user_id on reports (user_id);

-- ============================================================
-- saved_cvs
-- ============================================================
create table saved_cvs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  cv_data     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_saved_cvs_user_id on saved_cvs (user_id);

create trigger trg_saved_cvs_updated_at
  before update on saved_cvs
  for each row execute function set_updated_at();

-- ============================================================
-- cv_matches  (analytics log of match runs — see cv.controller.ts matchCV)
-- ============================================================
create table cv_matches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  match_score  integer not null,
  created_at   timestamptz not null default now()
);

create index idx_cv_matches_user_id on cv_matches (user_id);

-- ============================================================
-- Row Level Security
-- The backend currently talks to Postgres exclusively through the
-- Supabase service-role client (supabaseAdmin), which bypasses RLS —
-- see apps/backend/src/config/supabase.ts. These policies are a
-- defense-in-depth safety net for if/when the anon client (`supabase`
-- in that same file) is ever used directly, and are required for
-- Supabase's own security linter to pass on deploy.
-- ============================================================
alter table users enable row level security;
alter table companies enable row level security;
alter table reviews enable row level security;
alter table applications enable row level security;
alter table application_timeline enable row level security;
alter table communication_log enable row level security;
alter table reports enable row level security;
alter table saved_cvs enable row level security;
alter table cv_matches enable row level security;

create policy "users read own row" on users
  for select using (auth.uid() = id);
create policy "users update own row" on users
  for update using (auth.uid() = id);

create policy "companies public read" on companies
  for select using (true);

create policy "reviews public read approved" on reviews
  for select using (moderation_status = 'approved');
create policy "reviews owner read own" on reviews
  for select using (auth.uid() = reviewer_id);
create policy "reviews owner insert" on reviews
  for insert with check (auth.uid() = reviewer_id);

create policy "applications owner all" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "application_timeline owner all" on application_timeline
  for all using (
    auth.uid() = (select user_id from applications where applications.id = application_timeline.application_id)
  );

create policy "communication_log owner all" on communication_log
  for all using (
    auth.uid() = (select user_id from applications where applications.id = communication_log.application_id)
  );

create policy "reports owner all" on reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saved_cvs owner all" on saved_cvs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cv_matches owner all" on cv_matches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Storage
-- The app also uploads CVs to a bucket named 'cv-uploads' via
-- supabaseAdmin.storage (see cv.controller.ts uploadCV). Buckets
-- aren't created via SQL migrations — create it once per project:
--   supabase storage buckets create cv-uploads --no-public
-- or via Dashboard → Storage → New bucket (private).
-- ============================================================
