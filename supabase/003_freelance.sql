-- ============================================================
-- FILE: supabase/003_freelance.sql
-- Freelance marketplace: freelancer profiles, client projects,
-- proposals, contracts with milestones, contract messages and
-- two-way reviews. Run once in the SQL Editor AFTER 002_recruiters.sql.
-- Safe to re-run.
--
-- Money: amounts are whole units of `currency` and are a record of what
-- both sides agreed. No funds move through SafeApply yet.
--
-- Security: RLS ON with no policies + revoked grants, so only the backend
-- (service role) can read or write. Multi-row state changes (hire,
-- approve, cancel) run inside plpgsql functions so they are atomic and
-- race-safe (row locks), and only the service role may execute them.
-- ============================================================

-- ── Roles: user | recruiter | freelancer | client | admin ────
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
alter table public.users add constraint users_role_check
  check (role in ('user', 'recruiter', 'freelancer', 'client', 'admin'));

-- ── Freelancer profiles ──────────────────────────────────────
create table if not exists public.freelancer_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  headline text not null check (char_length(headline) between 5 and 120),
  bio text not null default '' check (char_length(bio) <= 3000),
  skills text[] not null default '{}' check (cardinality(skills) <= 15),
  hourly_rate integer check (hourly_rate is null or hourly_rate between 1 and 100000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  location text check (location is null or char_length(location) <= 120),
  portfolio_url text check (portfolio_url is null or portfolio_url ~* '^https?://'),
  available boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ── Projects (posted by clients; a budget is required) ───────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 140),
  description text not null check (char_length(description) between 50 and 10000),
  skills text[] not null default '{}' check (cardinality(skills) <= 10),
  budget_type text not null check (budget_type in ('fixed', 'hourly')),
  budget_min integer not null check (budget_min > 0),
  budget_max integer not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  duration text not null check (duration in ('under_week', 'one_month', 'three_months', 'longer')),
  status text not null default 'open' check (status in ('draft', 'open', 'in_progress', 'completed', 'cancelled', 'closed')),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max >= budget_min and budget_max <= 10000000)
);
-- Set when an admin closes a project; the client can't reopen it.
alter table public.projects add column if not exists moderated boolean not null default false;
create index if not exists projects_board_idx on public.projects (status, last_activity_at desc);
create index if not exists projects_client_idx on public.projects (client_id, created_at desc);
create index if not exists projects_skills_idx on public.projects using gin (skills);

-- ── Proposals (one per freelancer per project) ───────────────
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  freelancer_id uuid not null references public.users (id) on delete cascade,
  cover_letter text not null check (char_length(cover_letter) between 50 and 5000),
  amount integer not null check (amount between 1 and 10000000),
  duration_days integer not null check (duration_days between 1 and 365),
  status text not null default 'pending' check (status in ('pending', 'shortlisted', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, freelancer_id)
);
create index if not exists proposals_freelancer_idx on public.proposals (freelancer_id, created_at desc);
create index if not exists proposals_project_idx on public.proposals (project_id, created_at desc);

-- ── Contracts + milestones ───────────────────────────────────
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects (id) on delete cascade,
  proposal_id uuid not null unique references public.proposals (id) on delete cascade,
  client_id uuid not null references public.users (id) on delete cascade,
  freelancer_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  amount integer not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  cancelled_by uuid references public.users (id) on delete set null,
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (client_id <> freelancer_id)
);
create index if not exists contracts_client_idx on public.contracts (client_id, created_at desc);
create index if not exists contracts_freelancer_idx on public.contracts (freelancer_id, created_at desc);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text not null check (char_length(title) between 3 and 140),
  amount integer not null check (amount > 0),
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'revision', 'approved')),
  note text check (note is null or char_length(note) <= 2000),
  feedback text check (feedback is null or char_length(feedback) <= 2000),
  submitted_at timestamptz,
  approved_at timestamptz,
  unique (contract_id, position)
);

-- ── Contract messages ────────────────────────────────────────
create table if not exists public.contract_messages (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists contract_messages_idx on public.contract_messages (contract_id, created_at);

-- ── Two-way reviews after a contract ends (never deletable by users) ──
create table if not exists public.freelance_reviews (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  reviewer_id uuid not null references public.users (id) on delete cascade,
  reviewee_id uuid not null references public.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(comment) between 20 and 1500),
  created_at timestamptz not null default now(),
  unique (contract_id, reviewer_id)
);
create index if not exists freelance_reviews_reviewee_idx on public.freelance_reviews (reviewee_id, created_at desc);

-- ── Atomic: hire a proposal ──────────────────────────────────
-- Locks the proposal and project, checks ownership and state, requires the
-- milestones to add up exactly to the proposal amount, then creates the
-- contract, declines the other proposals and moves the project on.
create or replace function public.fl_hire(p_proposal uuid, p_client uuid, p_milestones jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_prop public.proposals;
  v_proj public.projects;
  v_total bigint;
  v_contract uuid;
  v_m jsonb;
  v_i int := 0;
begin
  select * into v_prop from public.proposals where id = p_proposal for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_proj from public.projects where id = v_prop.project_id for update;
  if not found or v_proj.client_id <> p_client then raise exception 'NOT_FOUND'; end if;
  if v_proj.status <> 'open' then raise exception 'PROJECT_NOT_OPEN'; end if;
  if v_prop.freelancer_id = p_client then raise exception 'SELF_HIRE'; end if;
  if v_prop.status not in ('pending', 'shortlisted') then raise exception 'PROPOSAL_NOT_AVAILABLE'; end if;
  if jsonb_typeof(p_milestones) <> 'array' or jsonb_array_length(p_milestones) not between 1 and 20 then
    raise exception 'BAD_MILESTONES';
  end if;
  select coalesce(sum((x ->> 'amount')::bigint), 0) into v_total from jsonb_array_elements(p_milestones) x;
  if v_total <> v_prop.amount then raise exception 'MILESTONE_TOTAL'; end if;

  insert into public.contracts (project_id, proposal_id, client_id, freelancer_id, title, amount, currency)
  values (v_proj.id, v_prop.id, v_proj.client_id, v_prop.freelancer_id, v_proj.title, v_prop.amount, v_proj.currency)
  returning id into v_contract;

  for v_m in select * from jsonb_array_elements(p_milestones) loop
    v_i := v_i + 1;
    insert into public.milestones (contract_id, position, title, amount, due_date)
    values (v_contract, v_i, v_m ->> 'title', (v_m ->> 'amount')::int, nullif(v_m ->> 'due_date', '')::date);
  end loop;

  update public.proposals set status = 'accepted', updated_at = now() where id = v_prop.id;
  update public.proposals set status = 'declined', updated_at = now()
    where project_id = v_proj.id and id <> v_prop.id and status in ('pending', 'shortlisted');
  update public.projects set status = 'in_progress', updated_at = now(), last_activity_at = now() where id = v_proj.id;
  return v_contract;
end $$;

-- ── Atomic: client approves a submitted milestone ────────────
-- Returns the contract status afterwards ('active' or 'completed').
create or replace function public.fl_approve(p_milestone uuid, p_client uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_c public.contracts;
  v_m public.milestones;
begin
  select * into v_m from public.milestones where id = p_milestone for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into v_c from public.contracts where id = v_m.contract_id for update;
  if v_c.client_id <> p_client then raise exception 'NOT_FOUND'; end if;
  if v_c.status <> 'active' then raise exception 'CONTRACT_NOT_ACTIVE'; end if;
  if v_m.status <> 'submitted' then raise exception 'NOT_SUBMITTED'; end if;

  update public.milestones set status = 'approved', approved_at = now() where id = v_m.id;
  if not exists (select 1 from public.milestones where contract_id = v_c.id and status <> 'approved') then
    update public.contracts set status = 'completed', completed_at = now(), updated_at = now() where id = v_c.id;
    update public.projects set status = 'completed', updated_at = now() where id = v_c.project_id;
    return 'completed';
  end if;
  update public.contracts set updated_at = now() where id = v_c.id;
  return 'active';
end $$;

-- ── Atomic: either side cancels before any work is handed in ─
create or replace function public.fl_cancel(p_contract uuid, p_user uuid, p_reason text)
returns void
language plpgsql
set search_path = public
as $$
declare v_c public.contracts;
begin
  select * into v_c from public.contracts where id = p_contract for update;
  if not found or p_user not in (v_c.client_id, v_c.freelancer_id) then raise exception 'NOT_FOUND'; end if;
  if v_c.status <> 'active' then raise exception 'CONTRACT_NOT_ACTIVE'; end if;
  if exists (select 1 from public.milestones where contract_id = v_c.id and status in ('submitted', 'approved')) then
    raise exception 'WORK_DELIVERED';
  end if;
  update public.contracts
    set status = 'cancelled', cancelled_by = p_user, cancel_reason = left(p_reason, 1000), updated_at = now()
    where id = v_c.id;
  update public.projects set status = 'cancelled', updated_at = now() where id = v_c.project_id;
end $$;

-- ── Lock down ────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['freelancer_profiles', 'projects', 'proposals', 'contracts', 'milestones', 'contract_messages', 'freelance_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

revoke all on function public.fl_hire(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fl_approve(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fl_cancel(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fl_hire(uuid, uuid, jsonb) to service_role;
grant execute on function public.fl_approve(uuid, uuid) to service_role;
grant execute on function public.fl_cancel(uuid, uuid, text) to service_role;
