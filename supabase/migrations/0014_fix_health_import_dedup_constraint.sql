-- Fixes 0013: a partial unique index (`where dedup_key is not null`) doesn't
-- match plain `ON CONFLICT (user_id, dedup_key)` target inference, which is
-- all supabase-js's .upsert() can express — every imported-log upsert failed
-- with "no unique or exclusion constraint matching the ON CONFLICT
-- specification". A full unique constraint gives the same protection: two
-- NULL dedup_keys never violate a unique constraint in Postgres, so manual
-- entries (which never set dedup_key) are still unaffected.

drop index if exists public.weight_logs_user_dedup_key_idx;
alter table public.weight_logs
  add constraint weight_logs_user_dedup_key_key unique (user_id, dedup_key);

drop index if exists public.sleep_logs_user_dedup_key_idx;
alter table public.sleep_logs
  add constraint sleep_logs_user_dedup_key_key unique (user_id, dedup_key);
