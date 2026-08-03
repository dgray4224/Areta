-- Lets a prescribed exercise carry 1-2 same-training-purpose alternatives
-- a user can swap to for the day (e.g. rowing intervals -> swimming or
-- biking intervals). Self-referencing FK rather than reusing
-- exercise_order as a grouping key: exercise_order is already
-- single-purpose (derived from authored array position), and Postgres
-- enforcing the primary/alternate relationship beats a same-value
-- convention nothing in the schema actually checks.

alter table public.program_session_exercises
  add column primary_exercise_id uuid references public.program_session_exercises (id) on delete cascade;

create index program_session_exercises_primary_idx
  on public.program_session_exercises (primary_exercise_id)
  where primary_exercise_id is not null;
