-- AI-generated recipe photo pipeline, phase 1: storage. A new public
-- bucket for photos written by scripts/backfill-recipe-photos.ts.
-- No client-side upload path exists or is planned -- this is
-- pipeline-written only, so (mirroring how public.recipes itself started
-- in migration 0006, before admin write access existed) only a public
-- select policy is added here. The service role used by the backfill
-- script bypasses RLS entirely, so no insert/update policy is needed for
-- it to write.
insert into storage.buckets (id, name, public)
values ('recipe-photos', 'recipe-photos', true)
on conflict (id) do nothing;

create policy "recipe_photos_public_read" on storage.objects
  for select using (bucket_id = 'recipe-photos');
