-- Whether this person has agreed to have their data sent to the
-- third-party AI provider (Anthropic) that writes the weekly brief.
-- App Store guideline 5.1.2(i) requires explicit permission before
-- personal data goes to a third-party AI; a privacy policy alone is not
-- enough.
--
-- Three states, deliberately: null = never asked (the app shows the
-- consent screen), true = agreed, false = declined. Declining is a real
-- answer, not "ask again later" -- the rest of the app works without AI,
-- and the brief simply isn't written.
alter table public.profiles
  add column if not exists ai_consent boolean,
  add column if not exists ai_consent_at timestamptz;

comment on column public.profiles.ai_consent is
  'null = not yet asked, true = agreed to send data to the AI provider, false = declined. Nothing is sent to the AI provider unless true.';
comment on column public.profiles.ai_consent_at is
  'When ai_consent was last set.';

-- profiles has column-level grants (0065_profiles_column_privileges), so
-- new columns are invisible to the app until granted. The person sets
-- their own answer from the app; RLS still limits it to their own row.
grant select (ai_consent, ai_consent_at) on public.profiles to authenticated;
grant update (ai_consent, ai_consent_at) on public.profiles to authenticated;
