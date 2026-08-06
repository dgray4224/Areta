-- Second /code-review pass on the trainer-role branch (2026-08-06),
-- each finding re-verified against actual source before fixing:
--
-- 1. goals_trainer_insert/generated_parameters_trainer_insert (0066)
--    granted full-row INSERT with no column restriction -- the 0070
--    triggers are BEFORE UPDATE only, so a trainer could bypass the
--    "status/priority only" / "approve-only" restriction entirely by
--    INSERTing a brand-new row instead of UPDATEing an existing one.
--    No app code ever needs trainer INSERT on either table (verified:
--    updateClientGoal and approveClientNutritionParameters/
--    approveAllGeneratedParameters are UPDATE-only) -- simplest fix is
--    just removing a capability nothing uses, rather than adding a
--    second trigger.
--
-- 2. restrict_trainer_parameter_columns()'s protected-column list
--    (0070) omitted assumptions/safety_bounds/review_date/
--    requires_user_approval/requires_professional_approval -- a
--    trainer could still strip a target's approval gate or safety
--    bounds via direct UPDATE despite the trigger's stated intent.
--    Fixed to cover every column except approved/approved_at (the only
--    ones approveAllGeneratedParameters actually writes) and user_id.
--
-- 3 & 4. profiles_trainer_select/profiles_select_by_client (0066/0068)
--    are row-level only; migration 0065 only ever restricted
--    profiles' INSERT/UPDATE columns, never SELECT, so a trainer/
--    client with row access (via those two policies) could read a
--    related party's *entire* row directly via PostgREST -- is_admin,
--    admin_role, is_trainer included. Column-level GRANT can't fix
--    this the way it fixed writes, for the same reason as goals/
--    generated_parameters: the row's own owner legitimately needs
--    full-column SELECT on their own row (profiles_select_own),
--    and Postgres privileges are per-role, not per-policy.
--
--    Separately, the marketplace's own name lookups (listDiscoverable-
--    Trainers, getTrainerPublicProfile, listMyTrainerRequests,
--    listIncomingTrainerRequests -- migration 0071) never worked in
--    the first place: browsing a discoverable trainer or a pending
--    request has no *active trainer_clients relationship* yet, so
--    profiles_trainer_select/profiles_select_by_client never applied
--    to them regardless -- every one of those screens always rendered
--    "Unnamed trainer"/"Unnamed client".
--
--    Both fixed together with one mechanism: drop the two row-level
--    SELECT policies entirely (closing the over-exposure), replaced by
--    a SECURITY DEFINER function that returns *only* full_name, gated
--    by the same relationship (trainer_clients) OR a marketplace
--    context (target is a discoverable trainer, or there's a
--    trainer_requests row between the two parties in either
--    direction) OR the caller's own id. Column-scoped by construction,
--    not by a grant that can't distinguish who's asking.

drop policy "goals_trainer_insert" on public.goals;
drop policy "generated_parameters_trainer_insert" on public.generated_parameters;

create or replace function public.restrict_trainer_parameter_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = new.user_id then
    return new;
  end if;

  if new.value is distinct from old.value
     or new.domain is distinct from old.domain
     or new.name is distinct from old.name
     or new.unit is distinct from old.unit
     or new.range_min is distinct from old.range_min
     or new.range_max is distinct from old.range_max
     or new.source is distinct from old.source
     or new.assumptions is distinct from old.assumptions
     or new.rationale is distinct from old.rationale
     or new.confidence is distinct from old.confidence
     or new.safety_bounds is distinct from old.safety_bounds
     or new.review_date is distinct from old.review_date
     or new.requires_user_approval is distinct from old.requires_user_approval
     or new.requires_professional_approval is distinct from old.requires_professional_approval
     or new.user_id is distinct from old.user_id
  then
    raise exception 'A trainer may only approve a client''s generated parameters as calculated, not edit them';
  end if;

  return new;
end;
$$;

drop policy "profiles_trainer_select" on public.profiles;
drop policy "profiles_select_by_client" on public.profiles;

create or replace function public.get_visible_profile_names(target_ids uuid[])
returns table (id uuid, full_name text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name
  from public.profiles p
  where p.id = any(target_ids)
    and (
      auth.uid() = p.id
      or public.is_trainer_of(auth.uid(), p.id)
      or public.is_trainer_of(p.id, auth.uid())
      or exists (
        select 1 from public.trainer_profiles tp
        where tp.trainer_id = p.id and tp.is_discoverable = true
      )
      or exists (
        select 1 from public.trainer_requests tr
        where (tr.client_id = auth.uid() and tr.trainer_id = p.id)
           or (tr.trainer_id = auth.uid() and tr.client_id = p.id)
      )
    );
$$;

grant execute on function public.get_visible_profile_names(uuid[]) to authenticated;
