-- Found during the security-review pass on the trainer-role branch
-- (2026-08-06): same bug class as migration 0065, smaller blast radius.
-- trainer_invite_codes_update_own (migration 0066) is row-level only
-- ("auth.uid() = trainer_id"), and Supabase's default table-level grant
-- gives `authenticated` INSERT/UPDATE on every column. A trainer could
-- PATCH used_at/used_by/revoked_at/expires_at/code directly on their own
-- rows via PostgREST -- not just the revoked_at-only mutation
-- revokeInviteCode() exposes at the app layer. Confirmed real (not
-- crossing a privilege boundary against an unwilling party, since a
-- trainer can only touch codes they already own and redemption still
-- requires a second party's voluntary action either way) but worth
-- closing on the same principle as 0065: the database grant is the
-- actual trust boundary, app code restricting itself to one column
-- isn't a substitute for it.
revoke insert, update on public.trainer_invite_codes from authenticated;

grant insert (trainer_id, code, expires_at) on public.trainer_invite_codes to authenticated;

grant update (revoked_at) on public.trainer_invite_codes to authenticated;
