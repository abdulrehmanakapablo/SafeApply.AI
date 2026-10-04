-- ============================================================
-- FILE: supabase/007_freelance_trust.sql
-- Phase 3: freelance trust tools.
--   • contact_views: who saw whose contact details (only on a contract)
--   • client_invites + verified_work: freelancers bring outside clients,
--     the client confirms the work, it becomes Verified work
--   • invoices (numbered per freelancer)
--   • payment_logs: off-platform payments, confirmed by the other side
-- Run AFTER 006_interviews.sql. Safe to re-run.
-- ============================================================

create table if not exists public.contact_views (
  contract_id uuid not null references public.contracts (id) on delete cascade,
  viewer_id uuid not null references public.users (id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  primary key (contract_id, viewer_id)
);

create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.users (id) on delete cascade,
  client_name text not null check (char_length(client_name) between 2 and 120),
  client_email text not null check (client_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(client_email) <= 254),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  expires_at timestamptz not null,
  responded_by uuid references public.users (id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists client_invites_freelancer_idx on public.client_invites (freelancer_id, created_at desc);

create table if not exists public.verified_work (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.users (id) on delete cascade,
  client_id uuid references public.users (id) on delete set null,
  invite_id uuid unique references public.client_invites (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text check (description is null or char_length(description) <= 2000),
  amount integer check (amount is null or amount between 1 and 10000000),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  completed_on date,
  status text not null default 'pending_client' check (status in ('pending_client', 'verified', 'declined')),
  client_note text check (client_note is null or char_length(client_note) <= 500),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verified_work_freelancer_idx on public.verified_work (freelancer_id, created_at desc);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  freelancer_id uuid not null references public.users (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete set null,
  client_id uuid references public.users (id) on delete set null,
  number text not null check (number ~ '^INV-\d{4}-\d{4,}$'),
  client_name text not null check (char_length(client_name) between 2 and 120),
  client_email text check (client_email is null or char_length(client_email) <= 254),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  total integer not null check (total between 0 and 100000000),
  notes text check (notes is null or char_length(notes) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  issued_on date not null default current_date,
  due_on date,
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (freelancer_id, number)
);
create index if not exists invoices_client_idx on public.invoices (client_id, created_at desc) where client_id is not null;

create table if not exists public.payment_logs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  logged_by uuid not null references public.users (id) on delete cascade,
  amount integer not null check (amount between 1 and 10000000),
  method text not null check (method in ('bank', 'wallet', 'cash', 'card', 'other')),
  paid_on date not null,
  note text check (note is null or char_length(note) <= 500),
  confirmed boolean,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_logs_contract_idx on public.payment_logs (contract_id, created_at);

do $$
declare t text;
begin
  foreach t in array array['contact_views', 'client_invites', 'verified_work', 'invoices', 'payment_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
