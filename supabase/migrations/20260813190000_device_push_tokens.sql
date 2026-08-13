-- Expo push tokens for the mobile app's weekly-review-ready notification
-- (Phase 2 of the enhancement roadmap discussed 2026-08-13 -- see
-- areta-mobile's docs/plans conversation). token is the primary key
-- (not a separate uuid id) so an upsert on the same physical device
-- naturally replaces its old row rather than accumulating duplicates.
--
-- Known, deliberately-not-handled edge case: if a second Areta account
-- signs in on a device that already registered a token under a
-- different account, that device's upsert will fail RLS (the existing
-- row's user_id won't match the new signed-in user) rather than
-- silently reassigning the token -- registerPushToken.ts's try/catch
-- swallows this as a best-effort no-op. Low-probability for a personal
-- health app; revisit with an admin-endpoint reassignment path only if
-- it actually comes up.
create table public.device_push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_device_push_tokens_updated_at
  before update on public.device_push_tokens
  for each row execute function public.set_updated_at();

alter table public.device_push_tokens enable row level security;

create policy "device_push_tokens_all_own" on public.device_push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index device_push_tokens_user_id_idx on public.device_push_tokens (user_id);
