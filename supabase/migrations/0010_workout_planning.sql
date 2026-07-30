-- Exercise's Outcome-to-Operating-Parameters engine (migration 0009) needs
-- a shared exercise library + per-user weekly plan to generate into — same
-- shape as meal planning (0006): recipes -> meal_plans/meal_plan_items.

-- Shared platform reference data, not per-user (CLAUDE.md rule 3). Every
-- authenticated user can read them; writes happen only via migration or
-- the service role, never through the app.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  movement_pattern text not null,
  equipment_required text[] not null default '{}',
  archetype_tags text[] not null default '{}',
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  primary_muscle_groups text[] not null default '{}',
  instructions text,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "exercises_select_all" on public.exercises
  for select using (true);

create index exercises_archetype_tags_idx on public.exercises using gin (archetype_tags);


create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  sessions_per_week numeric,
  phase_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create trigger set_workout_plans_updated_at
  before update on public.workout_plans
  for each row execute function public.set_updated_at();

alter table public.workout_plans enable row level security;

create policy "workout_plans_all_own" on public.workout_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index workout_plans_user_week_idx on public.workout_plans (user_id, week_start desc);


create table public.workout_plan_items (
  id uuid primary key default gen_random_uuid(),
  workout_plan_id uuid not null references public.workout_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  session_order smallint not null default 0,
  exercise_id uuid not null references public.exercises (id),
  sets integer,
  reps integer,
  duration_minutes integer,
  created_at timestamptz not null default now()
);

alter table public.workout_plan_items enable row level security;

create policy "workout_plan_items_all_own" on public.workout_plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index workout_plan_items_plan_idx on public.workout_plan_items (workout_plan_id);


-- Seed exercise library: a curated set spanning the 5 archetypes across
-- the equipment tiers offered in onboarding (EQUIPMENT_SUGGESTIONS).
insert into public.exercises
  (name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions) values

('Push-up', 'horizontal push', array['Bodyweight only'],
 array['general_fitness', 'hypertrophy', 'hybrid_athlete'], 'beginner',
 array['chest', 'triceps', 'shoulders'],
 'Hands under shoulders, lower chest to the floor, press back up keeping a straight line from head to heels.'),

('Bodyweight squat', 'squat', array['Bodyweight only'],
 array['general_fitness', 'hybrid_athlete'], 'beginner',
 array['quads', 'glutes'],
 'Feet shoulder-width, sit hips back and down, keep chest up, return to standing.'),

('Plank', 'core stability', array['Bodyweight only'],
 array['general_fitness', 'hybrid_athlete', 'long_distance_runner'], 'beginner',
 array['core'],
 'Forearms and toes on the floor, body in a straight line, hold.'),

('Reverse lunge', 'single-leg', array['Bodyweight only'],
 array['general_fitness', 'hybrid_athlete', 'long_distance_runner'], 'beginner',
 array['quads', 'glutes'],
 'Step one foot back, lower the rear knee toward the floor, push through the front foot to return.'),

('Burpee', 'full body / conditioning', array['Bodyweight only'],
 array['hybrid_athlete', 'general_fitness'], 'intermediate',
 array['full body'],
 'Squat, kick feet back to a plank, push up, jump feet forward, jump up.'),

('Dumbbell bench press', 'horizontal push', array['Dumbbells'],
 array['hypertrophy', 'general_fitness', 'hybrid_athlete'], 'beginner',
 array['chest', 'triceps', 'shoulders'],
 'Lying on a bench, press dumbbells up over the chest, lower under control.'),

('Dumbbell row', 'horizontal pull', array['Dumbbells'],
 array['hypertrophy', 'general_fitness', 'hybrid_athlete'], 'beginner',
 array['back', 'biceps'],
 'Hinge at the hips, row the dumbbell to the hip, squeeze the shoulder blade.'),

('Goblet squat', 'squat', array['Dumbbells', 'Kettlebells'],
 array['general_fitness', 'hybrid_athlete', 'hypertrophy'], 'beginner',
 array['quads', 'glutes'],
 'Hold a dumbbell or kettlebell at the chest, squat between the knees, stand back up.'),

('Dumbbell shoulder press', 'vertical push', array['Dumbbells'],
 array['hypertrophy', 'general_fitness'], 'beginner',
 array['shoulders', 'triceps'],
 'Press dumbbells overhead from shoulder height, lower under control.'),

('Dumbbell Romanian deadlift', 'hip hinge', array['Dumbbells'],
 array['hypertrophy', 'general_fitness', 'hybrid_athlete'], 'intermediate',
 array['hamstrings', 'glutes'],
 'Hinge at the hips with a slight knee bend, lower dumbbells along the shins, return by driving the hips forward.'),

('Barbell back squat', 'squat', array['Barbell', 'Full gym access'],
 array['powerlifter', 'hybrid_athlete', 'hypertrophy'], 'intermediate',
 array['quads', 'glutes'],
 'Bar on the upper back, squat to depth, drive through the floor to stand.'),

('Barbell deadlift', 'hip hinge', array['Barbell', 'Full gym access'],
 array['powerlifter', 'hybrid_athlete'], 'intermediate',
 array['hamstrings', 'glutes', 'back'],
 'Hinge down to the bar, brace, drive the floor away while keeping the bar close to the body.'),

('Barbell bench press', 'horizontal push', array['Barbell', 'Full gym access'],
 array['powerlifter', 'hypertrophy', 'hybrid_athlete'], 'intermediate',
 array['chest', 'triceps', 'shoulders'],
 'Lower the bar to the chest with control, press back up to lockout.'),

('Barbell overhead press', 'vertical push', array['Barbell', 'Full gym access'],
 array['powerlifter', 'hypertrophy'], 'intermediate',
 array['shoulders', 'triceps'],
 'Press the bar from the shoulders to overhead, keeping the ribs down.'),

('Barbell row', 'horizontal pull', array['Barbell', 'Full gym access'],
 array['powerlifter', 'hypertrophy', 'hybrid_athlete'], 'intermediate',
 array['back', 'biceps'],
 'Hinge forward, row the bar to the lower ribs, control the descent.'),

('Kettlebell swing', 'hip hinge / conditioning', array['Kettlebells'],
 array['hybrid_athlete', 'general_fitness'], 'beginner',
 array['glutes', 'hamstrings', 'core'],
 'Hinge and hike the kettlebell back, snap the hips forward to swing it to chest height.'),

('Kettlebell clean and press', 'full body', array['Kettlebells'],
 array['hybrid_athlete', 'hypertrophy'], 'advanced',
 array['full body'],
 'Clean the kettlebell to the rack position, press overhead, lower with control.'),

('Pull-up', 'vertical pull', array['Pull-up bar'],
 array['hybrid_athlete', 'hypertrophy', 'general_fitness'], 'intermediate',
 array['back', 'biceps'],
 'Hang from the bar, pull the chin over the bar, lower under control.'),

('Chin-up', 'vertical pull', array['Pull-up bar'],
 array['hybrid_athlete', 'hypertrophy', 'general_fitness'], 'intermediate',
 array['back', 'biceps'],
 'Underhand grip, pull the chin over the bar, lower under control.'),

('Hanging leg raise', 'core', array['Pull-up bar'],
 array['hybrid_athlete', 'hypertrophy'], 'intermediate',
 array['core'],
 'Hang from the bar, raise the legs to hip height or higher, lower with control.'),

('Easy-pace run', 'aerobic', array['Cardio machine', 'Bodyweight only'],
 array['long_distance_runner', 'hybrid_athlete', 'general_fitness'], 'beginner',
 array['legs', 'cardio'],
 'Sustained easy-effort running — conversational pace, builds aerobic base.'),

('Treadmill intervals', 'anaerobic / speed', array['Cardio machine'],
 array['long_distance_runner', 'hybrid_athlete'], 'intermediate',
 array['legs', 'cardio'],
 'Alternate hard-effort intervals with easy recovery jogs or walks.'),

('Rowing intervals', 'full body / conditioning', array['Cardio machine', 'Full gym access'],
 array['hybrid_athlete', 'general_fitness'], 'intermediate',
 array['full body', 'cardio'],
 'Alternate hard-effort rowing intervals with easy recovery paddling.'),

('Stationary bike steady-state', 'aerobic', array['Cardio machine', 'Full gym access'],
 array['long_distance_runner', 'general_fitness', 'hybrid_athlete'], 'beginner',
 array['legs', 'cardio'],
 'Sustained moderate-effort cycling for aerobic conditioning.'),

('Lat pulldown', 'vertical pull', array['Full gym access'],
 array['hypertrophy', 'general_fitness'], 'beginner',
 array['back', 'biceps'],
 'Pull the bar down to the upper chest, control the return.'),

('Leg press', 'squat', array['Full gym access'],
 array['hypertrophy', 'general_fitness', 'powerlifter'], 'beginner',
 array['quads', 'glutes'],
 'Press the platform away by extending the knees and hips, control the return.'),

('Cable row', 'horizontal pull', array['Full gym access'],
 array['hypertrophy', 'general_fitness'], 'beginner',
 array['back', 'biceps'],
 'Row the handle to the torso, squeeze the shoulder blades, control the return.');
