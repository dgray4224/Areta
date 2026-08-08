-- Single-use, short-lived codes that let the mobile app hand its existing
-- Supabase session to an in-app browser tab, so the tab can reuse the
-- already-built web Settings -> Calendar flow (OAuth for Google/Microsoft,
-- the Apple app-specific-password form) instead of re-implementing OAuth
-- token exchange natively. See app/api/auth/mobile-bridge/route.ts
-- (mints a code, bearer-authenticated) and app/auth/mobile-bridge/route.ts
-- (consumes it, unauthenticated by definition -- no session exists yet in
-- that browser tab).
--
-- Tokens are encrypted at rest with the same AES-256-GCM helper calendar
-- OAuth credentials use (platform/calendar/token-crypto.ts) -- these are a
-- live Supabase session, at least as sensitive as a calendar refresh token.
-- No RLS policies are defined on purpose: this table is only ever touched
-- by the service-role client (there's no auth.uid() to scope by before a
-- session exists), matching platform/supabase/admin.ts's documented usage.
--
-- Rows are small and inert once expires_at passes; no cleanup job exists
-- yet. Worth a cron sweep if volume ever justifies it (not expected at
-- current scale -- one row per mobile calendar-connect tap).
create table public.mobile_bridge_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.mobile_bridge_codes enable row level security;

create index mobile_bridge_codes_expires_at_idx on public.mobile_bridge_codes (expires_at);
