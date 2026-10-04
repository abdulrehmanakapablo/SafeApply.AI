-- ============================================================
-- FILE: supabase/004_billing.sql
-- Phase 0: monthly plans, manual local payments (JazzCash / Easypaisa /
-- bank), and a spending ledger with budgets so AI + search costs can never
-- run past what you set. Run AFTER 003_freelance.sql. Safe to re-run.
--
-- Plans: one 30-day "pro" period per approved payment, no auto-renew.
--   seekers / freelancers / clients → users.plan + users.plan_expires_at
--   recruiters                      → companies.pro_until (whole company)
-- ============================================================

alter table public.users
  add column if not exists plan_expires_at timestamptz,
  add column if not exists renewal_reminded_at timestamptz;

alter table public.companies
  add column if not exists pro_until timestamptz,
  add column if not exists pro_reminded_at timestamptz;

-- ── Manual payments ─────────────────────────────────────────
create table if not exists public.manual_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_key text not null check (plan_key in ('seeker', 'freelancer', 'client', 'recruiter')),
  method text not null check (method in ('jazzcash', 'easypaisa', 'bank')),
  transaction_id text not null check (transaction_id ~ '^[A-Za-z0-9-]{6,40}$'),
  sender_name text not null check (char_length(sender_name) between 2 and 80),
  amount_pkr integer not null check (amount_pkr between 1 and 1000000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 500),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now()
);
-- A transaction id can only ever be used once per method.
create unique index if not exists manual_payments_txn_uidx on public.manual_payments (method, upper(transaction_id));
create index if not exists manual_payments_status_idx on public.manual_payments (status, created_at);
create index if not exists manual_payments_user_idx on public.manual_payments (user_id, created_at desc);

-- ── Spending ledger + settings ──────────────────────────────
create table if not exists public.spend_months (
  month text primary key check (month ~ '^\d{4}-\d{2}$'),
  ai_usd numeric(12, 4) not null default 0,
  search_usd numeric(12, 4) not null default 0,
  ai_calls integer not null default 0,
  searches integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- free_usd: when the month's spend reaches this, AI pauses for FREE users.
-- hard_usd: when reached, AI + search stop for everyone (pocket protection).
insert into public.app_settings (key, value) values ('budget', '{"free_usd": 5, "hard_usd": 15}')
on conflict (key) do nothing;

create or replace function public.spend_add(p_kind text, p_usd numeric)
returns void
language sql
set search_path = public
as $$
  insert into public.spend_months (month, ai_usd, search_usd, ai_calls, searches)
  values (
    to_char(now() at time zone 'utc', 'YYYY-MM'),
    case when p_kind = 'ai' then p_usd else 0 end,
    case when p_kind = 'search' then p_usd else 0 end,
    case when p_kind = 'ai' then 1 else 0 end,
    case when p_kind = 'search' then 1 else 0 end
  )
  on conflict (month) do update set
    ai_usd = spend_months.ai_usd + excluded.ai_usd,
    search_usd = spend_months.search_usd + excluded.search_usd,
    ai_calls = spend_months.ai_calls + excluded.ai_calls,
    searches = spend_months.searches + excluded.searches,
    updated_at = now();
$$;

-- ── Atomic: approve a manual payment and extend the right plan ──
-- Stacks on top of any time left, so paying early never loses days.
create or replace function public.billing_approve(p_payment uuid, p_admin uuid, p_note text)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  v_p public.manual_payments;
  v_company uuid;
  v_end timestamptz;
begin
  select * into v_p from public.manual_payments where id = p_payment for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_p.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

  if v_p.plan_key = 'recruiter' then
    select company_id into v_company from public.company_members where user_id = v_p.user_id;
    if v_company is null then raise exception 'NO_COMPANY'; end if;
    update public.companies
      set pro_until = greatest(now(), coalesce(pro_until, now())) + interval '30 days', pro_reminded_at = null
      where id = v_company
      returning pro_until into v_end;
  else
    update public.users
      set plan = 'pro',
          plan_expires_at = greatest(now(), coalesce(case when plan = 'pro' then plan_expires_at end, now())) + interval '30 days',
          renewal_reminded_at = null
      where id = v_p.user_id and plan <> 'lifetime'
      returning plan_expires_at into v_end;
    if v_end is null then
      select coalesce(plan_expires_at, now()) into v_end from public.users where id = v_p.user_id;
    end if;
  end if;

  update public.manual_payments
    set status = 'approved', reviewed_by = p_admin, reviewed_at = now(), admin_note = nullif(left(p_note, 500), ''), period_end = v_end
    where id = v_p.id;
  return v_end;
end $$;

-- ── Lock down ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['manual_payments', 'spend_months', 'app_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on function public.spend_add(text, numeric) from public, anon, authenticated;
revoke all on function public.billing_approve(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.spend_add(text, numeric) to service_role;
grant execute on function public.billing_approve(uuid, uuid, text) to service_role;
