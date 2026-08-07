-- Self-service "become a trainer" requests. Previously the only way to
-- turn an account into a trainer was an admin-owner manually flipping
-- profiles.is_trainer from /admin/users/[id] (TrainerStatusForm.tsx) --
-- this adds a request queue an aspiring trainer submits themselves, with
-- an admin-owner approving/rejecting. Approval still goes through the
-- existing setUserTrainerStatus() (domains/users/service.ts) rather than
-- duplicating its logic, so revocation/marketplace-unlisting etc. stay
-- in one place.
--
-- Mirrors trainer_requests' (migration 0071) request/cancel-own RLS shape
-- (self-service insert + cancel, no client-facing approve path), and
-- the content-review tables' (migration 0044) reviewed_by/reviewed_at
-- columns -- more appropriate here than trainer_requests' responded_at,
-- since the approver isn't the resource subject the way a trainer
-- responding to their own incoming request is.
create table public.trainer_role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- One pending request per user -- simpler than trainer_requests' per-
-- (client, trainer) uniqueness since there's only one thing being
-- requested here (the platform itself granting trainer access), not a
-- choice among many trainers. DB-level guarantee, not just an app-level
-- check, same reasoning as trainer_clients_one_active_client (migration
-- 0066): holds even if a future caller forgets to check first.
create unique index trainer_role_requests_one_pending_per_user
  on public.trainer_role_requests (user_id)
  where status = 'pending';

create index trainer_role_requests_pending_idx
  on public.trainer_role_requests (created_at)
  where status = 'pending';

alter table public.trainer_role_requests enable row level security;

create policy "trainer_role_requests_select_own" on public.trainer_role_requests
  for select using (auth.uid() = user_id);

create policy "trainer_role_requests_insert_own" on public.trainer_role_requests
  for insert with check (auth.uid() = user_id);

-- Self-cancel only -- a user can withdraw their own pending request, but
-- can never set status to 'approved'/'rejected' themselves (no RLS path
-- reaches those transitions; only the service-role admin actions can).
create policy "trainer_role_requests_cancel_own" on public.trainer_role_requests
  for update using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'cancelled');

-- No admin-facing RLS select/update policy -- same reasoning as
-- setUserTrainerStatus and every other domains/users/service.ts action:
-- admin reads/writes go through the service-role client
-- (createAdminClient()) after an explicit requireAdminOwner() check
-- inside the action itself, not through a client-session RLS path.
