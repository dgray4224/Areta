-- Admin portal, phase C part 2: recipes has had RLS enabled with only a
-- select-all policy since migration 0006 — no write path has ever
-- existed. Mirrors exercises' write policy (migration 0060), plus the
-- same active/review/deprecated status shape exercises already has
-- (migration 0044) — a newly admin-authored recipe shouldn't be
-- immediately eligible for real meal-plan generation
-- (domains/mealplan/service.ts's generateMealPlan reads every row via
-- getAllRecipes with no filter today) before someone's confirmed its
-- macros/instructions are right. Existing seeded recipes default to
-- 'active' so nothing already live is affected.
alter table public.recipes
  add column status text not null default 'active' check (status in ('active', 'review', 'deprecated'));

create index recipes_status_idx on public.recipes (status);

create policy "recipes_admin_write" on public.recipes
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
