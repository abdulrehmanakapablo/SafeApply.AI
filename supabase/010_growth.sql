-- ============================================================
-- FILE: supabase/010_growth.sql
-- Phase 6: disputes and public sharing.
--   • disputes: anyone can contest a ghost flag, penalty or trust level
--     with evidence. Admins accept or reject with a note. Accepting a
--     ghost-flag dispute clears that job permanently (jobs.ghost_cleared).
--   • reports.share_id: the owner can publish a company report at an
--     unguessable link and revoke it any time. Off by default.
-- Run AFTER 009_teams.sql. Safe to re-run.
-- ============================================================

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  subject_type text not null check (subject_type in ('ghost_flag', 'penalty', 'trust_level', 'other')),
  subject_ref uuid,
  reason text not null check (char_length(reason) between 20 and 2000),
  evidence_url text check (evidence_url is null or (char_length(evidence_url) <= 500 and evidence_url ~ '^https://')),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  resolved_by uuid references public.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (subject_type <> 'ghost_flag' or (subject_ref is not null and company_id is not null))
);
create index if not exists disputes_user_idx on public.disputes (user_id, created_at desc);
create index if not exists disputes_open_idx on public.disputes (created_at) where status = 'open';
-- One open dispute per subject.
create unique index if not exists disputes_open_subject_uidx on public.disputes (subject_type, coalesce(subject_ref, user_id)) where status = 'open';

alter table public.disputes enable row level security;
revoke all on public.disputes from anon, authenticated;

alter table public.reports add column if not exists share_id uuid;
create unique index if not exists reports_share_uidx on public.reports (share_id) where share_id is not null;

-- Accept/reject atomically. Ghost-flag acceptance clears the job and
-- recomputes scores in the same transaction.
create or replace function public.resolve_dispute(p_id uuid, p_admin uuid, p_accept boolean, p_note text)
returns public.disputes
language plpgsql
set search_path = public
as $$
declare d public.disputes;
begin
  update public.disputes
     set status = case when p_accept then 'accepted' else 'rejected' end,
         admin_note = nullif(left(coalesce(p_note, ''), 1000), ''),
         resolved_by = p_admin,
         resolved_at = now()
   where id = p_id and status = 'open'
  returning * into d;
  if d.id is null then raise exception 'NOT_OPEN'; end if;
  if p_accept and d.subject_type = 'ghost_flag' then
    update public.jobs set ghost_cleared = true, ghost_flag = false where id = d.subject_ref and company_id = d.company_id;
    perform public.refresh_accountability();
  end if;
  return d;
end $$;
revoke all on function public.resolve_dispute(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.resolve_dispute(uuid, uuid, boolean, text) to service_role;
