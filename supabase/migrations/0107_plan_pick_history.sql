-- ============================================================
-- Weekly meal/workout customization: pick-history tables
--
-- Feeds a lightweight frequency-weighting signal into meal/workout plan
-- generation (domains/mealplan/generate.ts, domains/workoutplan/generate.ts):
-- every time a user explicitly assigns a recipe/session/exercise to a day
-- via the "Customize this week" flow, one row is logged per (item, day)
-- touched, so "assign to 3 days" counts 3x toward that item's frequency.
--
-- Deliberately NOT a flag on meal_plan_items/workout_plan_items (the way
-- workout_plan_items.substituted works today) -- those rows are
-- destructively deleted+reinserted on every plan regeneration
-- (generateAndSaveMealPlan/generateAndSaveWorkoutPlan), so a durable
-- signal that needs to accumulate across many past weeks can't live
-- there. These are plain append-only logs, never updated or deleted by
-- plan generation, read only via a bounded lookback window
-- (domains/mealplan/preferences.ts, domains/workoutplan/preferences.ts)
-- so old picks eventually stop dominating as tastes drift. Real
-- clustering/embeddings-based recommendation is explicitly out of scope
-- for this phase -- this is flat per-item pick-count only.
-- ============================================================

create table public.meal_pick_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  week_start date not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  picked_at timestamptz not null default now()
);

alter table public.meal_pick_history enable row level security;

create policy "meal_pick_history_all_own" on public.meal_pick_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index meal_pick_history_user_recipe_idx on public.meal_pick_history (user_id, recipe_id, picked_at desc);


create table public.exercise_pick_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  -- Set for a program-based session assignment (domains/workoutplan/
  -- customize.ts#assignWorkoutPlanSessionDays); null for a legacy/
  -- goal-first exercise-level assignment (#assignWorkoutPlanExerciseDays),
  -- which has no session concept to attribute to.
  session_id uuid references public.program_sessions (id) on delete set null,
  week_start date not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  picked_at timestamptz not null default now()
);

alter table public.exercise_pick_history enable row level security;

create policy "exercise_pick_history_all_own" on public.exercise_pick_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index exercise_pick_history_user_exercise_idx on public.exercise_pick_history (user_id, exercise_id, picked_at desc);
