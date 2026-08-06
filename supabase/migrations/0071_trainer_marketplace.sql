-- Trainer marketplace/discovery layer (2026-08-06) -- the piece
-- explicitly deferred when the trainer role was first scoped ("note
-- that we can add functionality to this... a trainer can update their
-- profile and market themselves"), built now on the user's explicit
-- confirmation. Two new concerns:
--
-- trainer_profiles: a trainer's public-facing marketing profile (bio,
-- experience, specialties, free-text location -- no real geocoding in
-- this pass, just city/region strings a client can filter on). Only
-- rows with is_discoverable = true are visible to anyone other than the
-- trainer themselves -- a trainer can build/edit their profile privately
-- before opting into being listed. Deliberately scoped to authenticated
-- browsing only (no anon/public policy) -- opening this to unauthenticated
-- visitors is a separate product decision this migration doesn't make.
--
-- trainer_requests: the client-initiated counterpart to the existing
-- trainer-issued invite code. A client requests a specific discoverable
-- trainer; the trainer accepts (creating a trainer_clients row, same
-- side effect as redeeming an invite code) or declines. Acceptance is
-- inherently a cross-user write (same reasoning as trainer_clients
-- itself, migration 0066) so it isn't expressed as a raw RLS update --
-- only a same-user "client creates/cancels their own pending request"
-- surface is exposed via RLS; accept/decline goes through a
-- service-role-backed action.

create table public.trainer_profiles (
  trainer_id uuid primary key references auth.users (id) on delete cascade,
  bio text,
  years_experience integer check (years_experience >= 0),
  specialties text[] not null default '{}',
  location_city text,
  location_region text,
  is_discoverable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_trainer_profiles_updated_at
  before update on public.trainer_profiles
  for each row execute function public.set_updated_at();

create index trainer_profiles_discoverable_idx on public.trainer_profiles (location_city, location_region)
  where is_discoverable = true;

alter table public.trainer_profiles enable row level security;

create policy "trainer_profiles_select_discoverable_or_own" on public.trainer_profiles
  for select using (is_discoverable = true or auth.uid() = trainer_id);

create policy "trainer_profiles_insert_own" on public.trainer_profiles
  for insert with check (auth.uid() = trainer_id and public.is_trainer(auth.uid()));

create policy "trainer_profiles_update_own" on public.trainer_profiles
  for update using (auth.uid() = trainer_id) with check (auth.uid() = trainer_id);

create policy "trainer_profiles_delete_own" on public.trainer_profiles
  for delete using (auth.uid() = trainer_id);

create table public.trainer_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users (id) on delete cascade,
  trainer_id uuid not null references auth.users (id) on delete cascade,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index trainer_requests_trainer_pending_idx on public.trainer_requests (trainer_id) where status = 'pending';
create index trainer_requests_client_idx on public.trainer_requests (client_id);

alter table public.trainer_requests enable row level security;

create policy "trainer_requests_select_own" on public.trainer_requests
  for select using (auth.uid() = client_id or auth.uid() = trainer_id);

create policy "trainer_requests_insert_own" on public.trainer_requests
  for insert with check (auth.uid() = client_id);

-- A client may only cancel their own still-pending request -- not
-- resurrect a declined one or otherwise touch status. Accept/decline
-- (the trainer side) is not expressible here since acceptance has the
-- cross-user side effect of creating a trainer_clients row -- see
-- respondToTrainerRequest (domains/trainer/service.ts), service-role.
--
-- RLS CHECK clauses can't pin "only status changed" the way a BEFORE
-- UPDATE trigger can (no OLD reference available) -- this policy's
-- WITH CHECK only constrains the row's *final* state (auth.uid() still
-- owns it, status is 'cancelled'), so a crafted call could smuggle a
-- changed trainer_id/message through alongside the cancellation.
-- Deliberately not worth a trigger here unlike goals/generated_parameters
-- (migration 0070): 'cancelled' is a terminal, inert status -- nothing
-- reads a cancelled request's trainer_id/message for anything, so
-- tampering with them has no real effect, unlike a live goal's outcome
-- text or an approved nutrition target's value.
create policy "trainer_requests_cancel_own" on public.trainer_requests
  for update using (auth.uid() = client_id and status = 'pending')
  with check (auth.uid() = client_id and status = 'cancelled');
