-- CRITICAL FIX, found 2026-08-06 while adding profiles.is_trainer for the
-- trainer role: profiles_update_own / profiles_insert_own (migration
-- 0001) are row-level policies only ("auth.uid() = id") with no
-- column-level restriction, and Supabase's default table-level grants
-- give `authenticated` INSERT/UPDATE on every column, including
-- is_admin/admin_role (added later, migrations 0044/0052). RLS is
-- row-level, not column-level -- a row policy that lets you touch your
-- own row lets you touch *every* column of it unless column privileges
-- say otherwise. Nothing in this app's own code has ever exploited this
-- (every real write goes through requireAdminOwner()-gated server
-- code), but any authenticated user could self-grant admin access with
-- a single direct PostgREST call using the public anon key and their
-- own session JWT:
--
--   PATCH /rest/v1/profiles?id=eq.<their-own-id>
--   { "is_admin": true, "admin_role": "owner" }
--
-- No app code, no Server Action, no requireAdminOwner() check ever runs
-- in that path -- it goes straight to Postgres. This is strictly more
-- severe than the Server Action privilege-escalation fix from earlier
-- today (that one needed the action's internal identifier; this needs
-- nothing but a normal account and the anon key, which ships in every
-- client bundle by design).
--
-- Fix: revoke the blanket table-level INSERT/UPDATE grant and re-grant
-- only the columns a user should ever be able to write to themselves
-- (the onboarding/identity fields from migration 0001). is_admin,
-- admin_role, and any future admin-or-trainer-ish column (is_trainer,
-- added right after this migration) are deliberately left off both
-- lists -- column privileges are per-column and not inherited by new
-- columns automatically, so is_trainer stays unwritable-by-client the
-- moment it's created, with no extra statement required. The only way
-- to write these columns going forward is the service-role client
-- (bypasses grants entirely), exactly like every admin-role write
-- already goes through domains/users/service.ts today.
revoke insert, update on public.profiles from authenticated;

grant insert (
  id,
  full_name,
  time_zone,
  units,
  wake_time,
  bed_time,
  work_status,
  work_hours_note,
  school_commitments,
  weekly_review_day,
  grocery_day,
  meal_prep_day,
  learning_time_minutes_per_week,
  onboarding_completed_at
) on public.profiles to authenticated;

grant update (
  full_name,
  time_zone,
  units,
  wake_time,
  bed_time,
  work_status,
  work_hours_note,
  school_commitments,
  weekly_review_day,
  grocery_day,
  meal_prep_day,
  learning_time_minutes_per_week,
  onboarding_completed_at
) on public.profiles to authenticated;
