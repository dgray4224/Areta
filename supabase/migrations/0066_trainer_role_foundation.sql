-- Trainer role foundation (B2B2C pivot, 2026-08-06): independent trainers
-- get scoped access to customize their own clients' goals, nutrition, and
-- workout programs, plus read access to full logged history so they can
-- actually coach. This is a different axis than the internal admin_role
-- (owner/reviewer) split from migration 0052 -- admin_role gates how much
-- of the internal admin tool a staff account can see; is_trainer gates
-- which *other users'* data a customer-facing trainer account can touch,
-- scoped per-client via trainer_clients rather than blanket.
--
-- Confirmed design decisions this migration encodes:
--   - One active trainer per client at a time (partial unique index below).
--   - Trainer sees full client history, not just current plan config.
--   - Trainers can never delete a client account (no such capability
--     exists anywhere in this migration -- only requireAdminOwner()-gated
--     domains/users/service.ts can delete an account, unchanged).
--   - Primary linking mechanism is a trainer-issued invite code the
--     client redeems; the client can revoke at any time.
-- A future trainer-marketplace/discovery layer (public trainer profiles,
-- browse-by-location, client-initiated requests) is explicitly deferred,
-- not represented in this schema yet.

alter table public.profiles
  add column is_trainer boolean not null default false;

-- profiles.is_trainer inherits the same client-unwritable protection as
-- is_admin/admin_role automatically -- migration 0065 switched profiles
-- to column-scoped INSERT/UPDATE grants for `authenticated`, and a newly
-- added column isn't included in that list unless explicitly granted.
-- Only the service-role client can ever set this (see
-- domains/users/service.ts's setUserTrainerStatus, added alongside this).

create or replace function public.is_trainer(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_trainer from public.profiles where id = uid), false);
$$;

-- ---------------------------------------------------------------------
-- trainer_clients: the relationship itself.
--
-- Deliberately no insert/update RLS policy on this table at all -- every
-- mutation (redeeming an invite code, ending a relationship from either
-- side) goes through a service-role server action with its own explicit
-- requireUser() check, same reasoning as domains/users/service.ts:
-- redemption is inherently a cross-user write (a client creating a row
-- that names someone else as trainer_id), which no same-user RLS check
-- can express safely, and "ending" needs to be callable by either party
-- without giving either party a broad UPDATE surface on the row. Select
-- is the only thing exposed via RLS, so both sides can see the
-- relationship in the regular app UI.
-- ---------------------------------------------------------------------
create table public.trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- The DB-level guarantee behind "one active trainer per client" -- not
-- just an app-level check, so it holds even if a future caller of the
-- redemption action forgets to check first.
create unique index trainer_clients_one_active_client
  on public.trainer_clients (client_id)
  where status = 'active';

create index trainer_clients_trainer_id_idx on public.trainer_clients (trainer_id) where status = 'active';

alter table public.trainer_clients enable row level security;

create policy "trainer_clients_select_trainer" on public.trainer_clients
  for select using (auth.uid() = trainer_id);

create policy "trainer_clients_select_client" on public.trainer_clients
  for select using (auth.uid() = client_id);

create or replace function public.is_trainer_of(p_trainer_id uuid, p_client_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.trainer_clients
    where trainer_id = p_trainer_id and client_id = p_client_id and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------
-- trainer_invite_codes: the primary linking mechanism. A trainer
-- generates a code; a client redeems it by presenting the code string
-- itself (knowledge of the code is the authorization, same idea as a
-- password-reset token) via a service-role-backed server action -- not
-- a direct table write, so no client-facing select/update policy is
-- needed for redemption. Trainers manage their own codes (create/revoke)
-- as an ordinary same-user RLS-gated action.
-- ---------------------------------------------------------------------
create table public.trainer_invite_codes (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz
);

create index trainer_invite_codes_trainer_id_idx on public.trainer_invite_codes (trainer_id);

alter table public.trainer_invite_codes enable row level security;

create policy "trainer_invite_codes_select_own" on public.trainer_invite_codes
  for select using (auth.uid() = trainer_id);

create policy "trainer_invite_codes_insert_own" on public.trainer_invite_codes
  for insert with check (auth.uid() = trainer_id and public.is_trainer(auth.uid()));

create policy "trainer_invite_codes_update_own" on public.trainer_invite_codes
  for update using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

-- ---------------------------------------------------------------------
-- Trainer access to client data. Every policy below is additive -- the
-- existing "<table>_all_own" policy from each table's original migration
-- is untouched, so nothing changes for a user acting on their own data.
-- Postgres OR's multiple permissive policies for the same command
-- together, so a trainer policy here only ever *adds* reachable rows,
-- never narrows what the row owner can already do.
--
-- Write access (select + insert + update, deliberately no delete -- a
-- trainer customizing a plan should never be able to delete a client's
-- records outright): goals, generated_parameters, meal_plans,
-- meal_plan_items, workout_plans, workout_plan_items.
-- ---------------------------------------------------------------------
create policy "goals_trainer_select" on public.goals
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "goals_trainer_insert" on public.goals
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "goals_trainer_update" on public.goals
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "generated_parameters_trainer_select" on public.generated_parameters
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "generated_parameters_trainer_insert" on public.generated_parameters
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "generated_parameters_trainer_update" on public.generated_parameters
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "meal_plans_trainer_select" on public.meal_plans
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "meal_plans_trainer_insert" on public.meal_plans
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "meal_plans_trainer_update" on public.meal_plans
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "meal_plan_items_trainer_select" on public.meal_plan_items
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "meal_plan_items_trainer_insert" on public.meal_plan_items
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "meal_plan_items_trainer_update" on public.meal_plan_items
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "workout_plans_trainer_select" on public.workout_plans
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "workout_plans_trainer_insert" on public.workout_plans
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "workout_plans_trainer_update" on public.workout_plans
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

create policy "workout_plan_items_trainer_select" on public.workout_plan_items
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "workout_plan_items_trainer_insert" on public.workout_plan_items
  for insert with check (public.is_trainer_of(auth.uid(), user_id));
create policy "workout_plan_items_trainer_update" on public.workout_plan_items
  for update using (public.is_trainer_of(auth.uid(), user_id)) with check (public.is_trainer_of(auth.uid(), user_id));

-- ---------------------------------------------------------------------
-- Read-only access (select only) -- full logged history plus review/
-- outcome records, so a trainer can see whether their programming is
-- actually working, and the client's own identity/schedule context.
-- ---------------------------------------------------------------------
create policy "weight_logs_trainer_select" on public.weight_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "sleep_logs_trainer_select" on public.sleep_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "nutrition_logs_trainer_select" on public.nutrition_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "recovery_logs_trainer_select" on public.recovery_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "workout_logs_trainer_select" on public.workout_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "exercise_logs_trainer_select" on public.exercise_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "step_logs_trainer_select" on public.step_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "heart_rate_logs_trainer_select" on public.heart_rate_logs
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "weekly_outcomes_trainer_select" on public.weekly_outcomes
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "weekly_reviews_trainer_select" on public.weekly_reviews
  for select using (public.is_trainer_of(auth.uid(), user_id));
create policy "profiles_trainer_select" on public.profiles
  for select using (public.is_trainer_of(auth.uid(), id));
