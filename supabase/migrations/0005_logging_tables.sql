-- Phase 2 daily logs: weight, sleep, nutrition, recovery, learning
-- (CLAUDE.md "Today and Logging" — field lists per log type).

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  weight numeric not null check (weight > 0),
  unit text not null check (unit in ('lb', 'kg')),
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.weight_logs enable row level security;

create policy "weight_logs_all_own" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index weight_logs_user_logged_at_idx on public.weight_logs (user_id, logged_at desc);


create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  bedtime timestamptz,
  wake_time timestamptz,
  total_duration_minutes integer check (total_duration_minutes >= 0),
  quality smallint check (quality between 1 and 5),
  interruptions integer check (interruptions >= 0),
  source text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.sleep_logs enable row level security;

create policy "sleep_logs_all_own" on public.sleep_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index sleep_logs_user_date_idx on public.sleep_logs (user_id, date desc);


-- Food-entry grained; a "meal" groups multiple entries by (user, date, meal).
-- saved_meal_label is a free-text placeholder until Phase 3's real saved
-- meals table exists.
create table public.nutrition_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food text not null,
  quantity numeric,
  unit text,
  calories numeric,
  protein numeric,
  carbohydrates numeric,
  fat numeric,
  fiber numeric,
  saved_meal_label text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.nutrition_logs enable row level security;

create policy "nutrition_logs_all_own" on public.nutrition_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index nutrition_logs_user_date_idx on public.nutrition_logs (user_id, date desc);


create table public.recovery_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  pain smallint check (pain between 0 and 10),
  swelling smallint check (swelling between 0 and 10),
  energy smallint check (energy between 1 and 5),
  brace_compliance boolean,
  medication_adherence boolean,
  elevation boolean,
  ice boolean,
  approved_exercises text,
  mobility text,
  warning_signs boolean not null default false,
  warning_signs_notes text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.recovery_logs enable row level security;

create policy "recovery_logs_all_own" on public.recovery_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index recovery_logs_user_date_idx on public.recovery_logs (user_id, date desc);


create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  track text,
  task text not null,
  duration_minutes integer check (duration_minutes >= 0),
  focus smallint check (focus between 1 and 5),
  output text,
  link text,
  reflection text,
  next_step text,
  created_at timestamptz not null default now()
);

alter table public.study_sessions enable row level security;

create policy "study_sessions_all_own" on public.study_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index study_sessions_user_date_idx on public.study_sessions (user_id, date desc);
