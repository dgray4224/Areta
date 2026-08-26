-- Monthly aggregates of stored health data, for reconciling against what
-- HealthKit itself reports.
--
-- Exists as a function because the comparison needs a GROUP BY over the
-- whole history: one real account has ~167,000 rows, and PostgREST caps a
-- response at 1,000. Fetching rows to the phone to count them there would
-- also mean the integrity check is only as trustworthy as the transport
-- it is checking.
--
-- Bucketed in the USER'S timezone, not UTC. The device buckets HealthKit's
-- statistics by local month; comparing those against UTC months would
-- disagree by a few hours at every month boundary and report a mismatch
-- on data that is perfectly intact.
--
-- security invoker so RLS on health_metrics still applies — the p_user_id
-- predicate is defence in depth, not the access control.
--
-- Filename version matches the version MCP apply_migration stamped
-- remotely (see docs/supabase-migrations.md), so `supabase db push` will
-- not replay it.
create or replace function public.health_monthly_totals(
  p_user_id uuid,
  p_timezone text default 'UTC'
)
returns table (
  metric_type text,
  month text,
  sample_count bigint,
  total numeric,
  average numeric,
  minimum numeric,
  maximum numeric,
  first_at timestamptz,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    hm.metric_type,
    to_char(hm.started_at at time zone p_timezone, 'YYYY-MM') as month,
    count(*)::bigint,
    sum(hm.value)::numeric,
    avg(hm.value)::numeric,
    min(hm.value)::numeric,
    max(hm.value)::numeric,
    min(hm.started_at),
    max(hm.started_at)
  from public.health_metrics hm
  where hm.user_id = p_user_id
  group by 1, 2
$$;

comment on function public.health_monthly_totals(uuid, text) is
  'Per-metric, per-month aggregates of stored health data, bucketed in the given timezone. Used by the mobile reconciliation check to compare what we stored against what HealthKit reports.';

grant execute on function public.health_monthly_totals(uuid, text) to authenticated;
