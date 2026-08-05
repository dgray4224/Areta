-- Admin portal, phase A: role granularity on top of migration 0044's
-- profiles.is_admin. is_admin keeps meaning "has some admin portal
-- access" (existing experts/sources/expert_claims/limitation_rules RLS
-- write policies already key off is_admin() and stay correct for both
-- roles below); admin_role narrows what that access covers once a
-- second admin (a content reviewer) actually exists.
--
-- 'owner'    - full access: content review, content management, ops,
--              user management.
-- 'reviewer' - content review only (experts/sources/expert_claims/
--              limitation_rules); app-route-level gating (not RLS) is
--              what actually restricts reviewers from ops/users pages,
--              since reviewers legitimately need the same table writes
--              owners do to approve/reject content.
alter table public.profiles
  add column admin_role text check (admin_role in ('owner', 'reviewer'));

alter table public.profiles
  add constraint profiles_admin_role_requires_is_admin
  check (admin_role is null or is_admin = true);

-- Backfill: whoever is already is_admin today becomes 'owner' (the
-- founder account, promoted by hand pre-portal).
update public.profiles set admin_role = 'owner' where is_admin = true;

create or replace function public.is_admin_owner(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select admin_role = 'owner' from public.profiles where id = uid),
    false
  );
$$;

-- Small queue-filtering indexes; expert_claims already has one
-- (migration 0044), experts/limitation_rules didn't need one until an
-- admin queue existed to filter by status.
create index experts_status_idx on public.experts (status);
create index limitation_rules_status_idx on public.limitation_rules (status);
