-- Admin portal, phase C: exercises has had RLS enabled with only a
-- select-all policy since migration 0010 — no insert/update/delete path
-- has ever existed for it (all current exercise content is seeded via
-- hand-written migrations). This adds the same is_admin()-gated write
-- policy already used for experts/sources/expert_claims/limitation_rules
-- (migration 0044), so the admin exercise-library editor has something
-- to write to.
create policy "exercises_admin_write" on public.exercises
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create index exercises_status_idx on public.exercises (status);
