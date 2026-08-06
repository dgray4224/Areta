-- Follow-up to 0066: a trainer can already SELECT their assigned
-- clients' profiles (profiles_trainer_select). The reverse direction was
-- missing -- a client has no way to read basic info (name) about their
-- own assigned trainer, needed for "Your trainer: <name>" in the
-- client-side settings UI (domains/trainer's getMyTrainerRelationship).
create policy "profiles_select_by_client" on public.profiles
  for select using (
    exists (
      select 1 from public.trainer_clients
      where trainer_id = profiles.id and client_id = auth.uid() and status = 'active'
    )
  );
