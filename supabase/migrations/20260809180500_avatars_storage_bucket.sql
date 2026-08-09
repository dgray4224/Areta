-- Profile photo uploads (mobile Settings -> Profile). Unlike
-- recipe-photos (0105, pipeline-written only via the service role), this
-- bucket is written directly by users from the client with the anon key,
-- so it needs real insert/update/delete RLS -- the standard Supabase
-- avatar-bucket pattern: each user's objects live under a folder named
-- for their own auth uid (mobile uploads to `${userId}/avatar.<ext>`),
-- and storage.foldername(name)[1] (the first path segment) is checked
-- against auth.uid() so a user can only ever write inside their own
-- folder. Public read (public: true) since these are just profile
-- pictures, same as recipe-photos, and simplest for expo-image to load
-- straight from the returned public URL with no signed-URL refresh logic.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
