-- Trainer access to a client's `domains` rows, scoped to the same three
-- fitness-relevant keys as the goals policies (migration 0077) --
-- assignProgramToClient needs to find-or-create the client's "exercise"
-- domain to attach the linked tangible-outcome goal to (migration 0078).
-- Select is needed to look one up; insert is needed the first time a
-- client has never had an exercise-domain row created (not every
-- onboarding path guarantees one exists in advance).

create policy "domains_trainer_select" on public.domains
  for select using (
    public.is_trainer_of(auth.uid(), user_id) and key in ('nutrition', 'exercise', 'recovery')
  );

create policy "domains_trainer_insert" on public.domains
  for insert
  with check (
    public.is_trainer_of(auth.uid(), user_id) and key in ('nutrition', 'exercise', 'recovery')
  );
