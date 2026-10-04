-- ============================================================
-- FILE: supabase/009_teams.sql
-- Phase 5: recruiter teams + talent search.
--   • team_invites: owners invite colleagues (single-use hashed token)
--   • candidate_notes: shared notes, ratings and @mentions on applicants
--   • talent_profiles: seekers opt in to be found; can hide from chosen
--     companies (e.g. their current employer). Hidden by default.
--   • talent_folders / items and talent_invites (invite to apply)
-- Run AFTER 008_trust.sql. Safe to re-run.
-- ============================================================

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  token_hash text not null unique check (char_length(token_hash) = 64),
  invited_by uuid references public.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  expires_at timestamptz not null,
  accepted_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists team_invites_company_idx on public.team_invites (company_id, created_at desc);

create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.job_applications (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid references public.users (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  rating smallint check (rating is null or rating between 1 and 5),
  mentions uuid[] not null default '{}' check (cardinality(mentions) <= 10),
  created_at timestamptz not null default now()
);
create index if not exists candidate_notes_app_idx on public.candidate_notes (application_id, created_at);

create table if not exists public.talent_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  -- Opaque id shown to recruiters; the account id never leaves the server.
  public_id uuid not null unique default gen_random_uuid(),
  visible boolean not null default false,
  open_to_work boolean not null default false,
  headline text check (headline is null or char_length(headline) <= 120),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  location text check (location is null or char_length(location) <= 120),
  desired_roles text check (desired_roles is null or char_length(desired_roles) <= 300),
  work_modes text[] not null default '{}' check (work_modes <@ array['onsite', 'hybrid', 'remote']::text[]),
  hidden_company_ids uuid[] not null default '{}' check (cardinality(hidden_company_ids) <= 20),
  updated_at timestamptz not null default now()
);
create index if not exists talent_visible_idx on public.talent_profiles (open_to_work desc, updated_at desc) where visible;
create index if not exists talent_skills_idx on public.talent_profiles using gin (skills);

create table if not exists public.talent_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create table if not exists public.talent_folder_items (
  folder_id uuid not null references public.talent_folders (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  added_by uuid references public.users (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);

create table if not exists public.talent_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  sent_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, user_id, job_id)
);
create index if not exists talent_invites_company_month_idx on public.talent_invites (company_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['team_invites', 'candidate_notes', 'talent_profiles', 'talent_folders', 'talent_folder_items', 'talent_invites'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- ── Atomic caps (a per-company advisory lock stops parallel requests
--    from slipping past the seat or invite limits) ───────────────────
create or replace function public.team_seat_cap(p_company uuid, p_free int, p_pro int)
returns int
language sql
stable
set search_path = public
as $$
  select case when pro_until > now() then p_pro else p_free end from public.companies where id = p_company
$$;

create or replace function public.team_invite_add(p_company uuid, p_email text, p_hash text, p_by uuid, p_expires timestamptz, p_free int, p_pro int)
returns uuid
language plpgsql
set search_path = public
as $$
declare v_id uuid; v_used int;
begin
  perform pg_advisory_xact_lock(hashtextextended('team:' || p_company::text, 0));
  select (select count(*) from public.company_members where company_id = p_company)
       + (select count(*) from public.team_invites where company_id = p_company and status = 'pending' and expires_at > now())
    into v_used;
  if v_used >= public.team_seat_cap(p_company, p_free, p_pro) then raise exception 'SEAT_LIMIT'; end if;
  if exists (select 1 from public.team_invites where company_id = p_company and email = p_email and status = 'pending' and expires_at > now()) then
    raise exception 'DUPLICATE';
  end if;
  insert into public.team_invites (company_id, email, token_hash, invited_by, expires_at)
  values (p_company, p_email, p_hash, p_by, p_expires)
  returning id into v_id;
  return v_id;
end $$;

-- Seats are re-checked at accept time, so a plan that lapsed after the
-- invites went out can't end up with more members than it allows.
create or replace function public.team_join(p_hash text, p_user uuid, p_email text, p_free int, p_pro int)
returns uuid
language plpgsql
set search_path = public
as $$
declare inv public.team_invites;
begin
  select * into inv from public.team_invites where token_hash = p_hash for update;
  if inv.id is null or inv.status <> 'pending' or inv.expires_at < now() then raise exception 'INVALID'; end if;
  if inv.email <> lower(p_email) then raise exception 'EMAIL_MISMATCH'; end if;
  perform pg_advisory_xact_lock(hashtextextended('team:' || inv.company_id::text, 0));
  if (select count(*) from public.company_members where company_id = inv.company_id) >= public.team_seat_cap(inv.company_id, p_free, p_pro) then
    raise exception 'SEAT_LIMIT';
  end if;
  insert into public.company_members (company_id, user_id, member_role) values (inv.company_id, p_user, 'recruiter');
  update public.team_invites set status = 'accepted', accepted_by = p_user where id = inv.id;
  return inv.company_id;
end $$;

create or replace function public.talent_invite_add(p_company uuid, p_user uuid, p_job uuid, p_by uuid, p_cap int)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('talent:' || p_company::text, 0));
  if (select count(*) from public.talent_invites
       where company_id = p_company
         and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc') >= p_cap then
    raise exception 'CAP';
  end if;
  insert into public.talent_invites (company_id, user_id, job_id, sent_by) values (p_company, p_user, p_job, p_by);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.team_seat_cap(uuid, int, int)',
    'public.team_invite_add(uuid, text, text, uuid, timestamptz, int, int)',
    'public.team_join(text, uuid, text, int, int)',
    'public.talent_invite_add(uuid, uuid, uuid, uuid, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
