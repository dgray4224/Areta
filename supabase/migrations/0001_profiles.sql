-- Platform foundation: UUID generation, a shared updated_at trigger, and
-- the profiles table (one row per auth.users row, holds identity/schedule
-- fields captured during onboarding's "Identity and schedule" step).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  time_zone text,
  units text check (units in ('metric', 'imperial')),
  wake_time time,
  bed_time time,
  work_status text,
  work_hours_note text,
  school_commitments text,
  -- 0 = Sunday .. 6 = Saturday
  weekly_review_day smallint check (weekly_review_day between 0 and 6),
  grocery_day smallint check (grocery_day between 0 and 6),
  meal_prep_day smallint check (meal_prep_day between 0 and 6),
  learning_time_minutes_per_week integer check (learning_time_minutes_per_week >= 0),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);
