-- Mobile Settings -> Profile is adding photo upload; the profile photo's
-- public Storage URL needs somewhere to live. Nullable, matches every
-- other optional profiles column added post-onboarding (see 0001).
alter table public.profiles
  add column avatar_url text;
