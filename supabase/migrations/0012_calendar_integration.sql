-- Read-only calendar integration (Google, Microsoft/Outlook, Apple/iCloud).
-- One row per provider connection. Google and Microsoft store real OAuth
-- tokens exchanged via their respective consent flows. Apple has no OAuth
-- API for CalDAV — it reuses the same columns with its app-specific password
-- in refresh_token_encrypted (the "long-lived secret" slot), access_token_encrypted
-- left null, and token_expires_at set to a far-future sentinel since
-- app-specific passwords don't expire on a schedule, only on manual
-- revocation at appleid.apple.com. Don't assume every row is a real OAuth
-- token when reading this table.
create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'apple')),
  external_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger set_calendar_connections_updated_at
  before update on public.calendar_connections
  for each row execute function public.set_updated_at();

alter table public.calendar_connections enable row level security;

create policy "calendar_connections_all_own" on public.calendar_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index calendar_connections_user_id_idx on public.calendar_connections (user_id);
