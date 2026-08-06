-- Third /code-review pass on the trainer-role branch (2026-08-06):
--
-- trainer_profiles_update_own (0071) only checked `auth.uid() =
-- trainer_id`, unlike trainer_profiles_insert_own right above it, which
-- also required is_trainer(auth.uid()). setUserTrainerStatus revoking a
-- trainer sets trainer_profiles.is_discoverable = false as a courtesy
-- (migration 2fea05d), but that's a data update, not a permission
-- change -- without this fix, the revoked account's still-valid session
-- could PATCH its own trainer_profiles row directly and flip
-- is_discoverable back to true, silently undoing the revocation.
drop policy "trainer_profiles_update_own" on public.trainer_profiles;

create policy "trainer_profiles_update_own" on public.trainer_profiles
  for update using (auth.uid() = trainer_id and public.is_trainer(auth.uid()))
  with check (auth.uid() = trainer_id and public.is_trainer(auth.uid()));
