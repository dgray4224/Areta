-- Two changes requested 2026-08-06, after the calendar feature shipped:
--
-- 1. Trainers should only see a client's *fitness-relevant* goals (not
--    career/finance/learning goals -- personal, not their business) and
--    only *current* ones (not past/achieved/abandoned). Previously
--    goals_trainer_select/update only checked the trainer_clients
--    relationship, exposing every goal in every domain regardless of
--    status. Enforced at the RLS layer, not just hidden in the UI --
--    same reasoning as every other trainer-scope fix this session: a
--    direct API call must respect the same boundary the UI implies.
--    goals_trainer_insert (dropped in migration 0072 as unused) is
--    re-added, scoped by the same predicate, now that trainer-authored
--    program assignments need to create a linked goal on the client's
--    behalf (migration 0078).
--
-- 2. (Prep for migration 0078) Nothing else here yet -- see that file
--    for the assignment end_date/goal_outcome/linked_goal_id columns
--    that depend on this insert policy existing first.

drop policy "goals_trainer_select" on public.goals;
create policy "goals_trainer_select" on public.goals
  for select using (
    public.is_trainer_of(auth.uid(), user_id)
    and status = 'active'
    and exists (
      select 1 from public.domains d
      where d.id = goals.domain_id and d.key in ('nutrition', 'exercise', 'recovery')
    )
  );

drop policy "goals_trainer_update" on public.goals;
create policy "goals_trainer_update" on public.goals
  for update using (
    public.is_trainer_of(auth.uid(), user_id)
    and status = 'active'
    and exists (
      select 1 from public.domains d
      where d.id = goals.domain_id and d.key in ('nutrition', 'exercise', 'recovery')
    )
  )
  with check (public.is_trainer_of(auth.uid(), user_id));

-- Column restriction (goals_restrict_trainer_columns, migration 0070)
-- already forbids a trainer from changing domain_id on UPDATE, so the
-- USING clause's domain check above can't be evaded by moving a goal
-- into/out of scope after the fact.

create policy "goals_trainer_insert" on public.goals
  for insert
  with check (
    public.is_trainer_of(auth.uid(), user_id)
    and status = 'active'
    and exists (
      select 1 from public.domains d
      where d.id = domain_id and d.key in ('nutrition', 'exercise', 'recovery')
    )
  );
