-- Admin portal, phase E: experts/expert_claims/limitation_rules.reviewed_by
-- (migration 0044) reference auth.users with no ON DELETE rule, which
-- defaults to NO ACTION -- deleting a user who ever reviewed anything
-- would fail outright with a foreign key violation. Set null instead:
-- the review decision and its evidence trail stay intact, just without
-- attribution to a since-deleted account. Postgres's default constraint
-- naming (<table>_<column>_fkey) is what migration 0044 relied on
-- implicitly, so that's what's being replaced here.
alter table public.experts
  drop constraint experts_reviewed_by_fkey,
  add constraint experts_reviewed_by_fkey foreign key (reviewed_by) references auth.users (id) on delete set null;

alter table public.expert_claims
  drop constraint expert_claims_reviewed_by_fkey,
  add constraint expert_claims_reviewed_by_fkey foreign key (reviewed_by) references auth.users (id) on delete set null;

alter table public.limitation_rules
  drop constraint limitation_rules_reviewed_by_fkey,
  add constraint limitation_rules_reviewed_by_fkey foreign key (reviewed_by) references auth.users (id) on delete set null;
