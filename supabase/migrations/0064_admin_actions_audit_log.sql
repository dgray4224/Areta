-- Admin portal: append-only audit trail for admin actions. Content
-- review already records reviewed_by/reviewed_at directly on the row
-- (experts/expert_claims/limitation_rules, migration 0044), but role
-- changes and account deletions left no trace anywhere -- flagged during
-- the 2026-08-06 admin-portal review alongside the users/service.ts
-- privilege-escalation fix.
--
-- Deliberately no update/delete RLS policy for anyone, including owners
-- -- an audit log that can be edited after the fact isn't one. Writes go
-- through the service-role client from platform/audit/log.ts, called
-- only from server code paths that have already run requireAdmin() /
-- requireAdminOwner() themselves, so there's no separate insert policy
-- to author here; reads are owner-only.
create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index admin_actions_target_idx on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;

create policy "admin_actions_owner_select" on public.admin_actions
  for select using (public.is_admin_owner(auth.uid()));
