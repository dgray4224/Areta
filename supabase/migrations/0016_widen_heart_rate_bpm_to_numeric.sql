-- 0015 typed heart_rate_logs.bpm as integer, but HealthKit heart rate
-- samples are frequently fractional (averaged over the sample window,
-- e.g. 77.00000000000001 bpm) — discovered when real device syncs failed
-- with "invalid input syntax for type integer" on ~25 of 200 samples.
-- Widening int -> numeric is lossless for rows already inserted.

alter table public.heart_rate_logs
  drop constraint heart_rate_logs_bpm_check;

alter table public.heart_rate_logs
  alter column bpm type numeric using bpm::numeric;

alter table public.heart_rate_logs
  add constraint heart_rate_logs_bpm_check check (bpm > 0);
