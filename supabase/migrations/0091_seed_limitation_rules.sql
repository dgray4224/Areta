-- Seeds limitation_rules (empty since 0044 created it) for all 10
-- LIMITATION_TAGS in domains/exercise/schema.ts. Engine semantics
-- (domains/recommendation/fill-slots.ts):
--   exclude        -> exercises with the movement pattern are removed
--                     from the candidate pool BEFORE scoring (hard
--                     filter, per 0044's own doc comment) for users
--                     with the tag.
--   substitute     -> the pattern is avoided, and slots targeting it
--                     re-target substitute_movement_pattern instead --
--                     the "same stimulus, offloaded pattern" behavior
--                     (see the joint_friendly_substitution claim).
--   manual_review  -> no automatic filtering; the generated plan
--                     carries a visible "have this reviewed" warning.
-- These pattern-level rules run in addition to the per-exercise
-- limitation_tags backfilled in 0089 (exercise-level tags catch
-- specific risky exercises; these catch whole patterns).
--
-- movement_pattern values use 0089's normalized taxonomy. Both
-- movement_pattern and exercise_id null (allowed by the
-- limitation_rules_not_both_targets check) = a tag-level rule.

insert into public.limitation_rules
  (limitation_tag, action, movement_pattern, substitute_movement_pattern, rationale, source_id, status, reviewed_at)
values
  -- Lower back
  ('lower_back', 'exclude', 'olympic_lift', null,
   'Explosive barbell lifts load the spine under speed and fatigue -- not appropriate with an active low-back limitation.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'approved', now()),
  ('lower_back', 'substitute', 'hinge', 'hip_extension',
   'Hip-extension work (hip thrusts, glute bridges, back extensions) trains the posterior chain with far less spinal shear than loaded hinging.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),

  -- Knee
  ('knee', 'exclude', 'power', null,
   'Jump/plyometric landings impose high patellofemoral and tendon loads -- excluded with an active knee limitation.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'approved', now()),
  ('knee', 'exclude', 'jump_rope', null,
   'Repetitive jumping is high-frequency impact on the knee -- excluded with an active knee limitation.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'approved', now()),
  ('knee', 'substitute', 'squat', 'hip_extension',
   'Hip-dominant work keeps training the lower body while limiting deep loaded knee flexion.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),
  ('knee', 'substitute', 'run', 'bike',
   'Cycling preserves the aerobic stimulus without running''s repetitive impact loading on the knee.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),

  -- Shoulder
  ('shoulder', 'exclude', 'vertical_push', null,
   'Overhead pressing is the most commonly aggravating pattern for shoulder limitations -- excluded by default.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),
  ('shoulder', 'substitute', 'vertical_pull', 'horizontal_pull',
   'Rowing patterns train the back through a shoulder-friendlier range than overhead hanging pulls.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),

  -- Hip
  ('hip', 'exclude', 'lunge', null,
   'Deep split-stance positions demand end-range hip flexion and adduction control -- excluded with an active hip limitation.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),
  ('hip', 'substitute', 'squat', 'hip_extension',
   'Bridge/thrust patterns strengthen the hip without deep flexion under load.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),

  -- Wrist / elbow
  ('wrist_or_elbow', 'exclude', 'olympic_lift', null,
   'The rack and overhead receiving positions load the wrist and elbow at end range under speed -- excluded with an active limitation there.',
   (select id from public.sources where canonical_url = 'https://andygalpin.com'),
   'approved', now()),
  ('wrist_or_elbow', 'substitute', 'horizontal_push', 'chest_isolation',
   'Cable/fly variations train the chest while sparing the loaded wrist-extension position of pressing and push-ups.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),

  -- Ankle / foot
  ('ankle_or_foot', 'exclude', 'jump_rope', null,
   'Repetitive jumping is direct high-frequency impact on the ankle and foot.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'approved', now()),
  ('ankle_or_foot', 'exclude', 'power', null,
   'Plyometric landings load the ankle complex at high force -- excluded with an active limitation.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'approved', now()),
  ('ankle_or_foot', 'substitute', 'run', 'bike',
   'Cycling preserves aerobic training without running''s impact on the ankle and foot.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'approved', now()),

  -- Neck
  ('neck', 'manual_review', null, null,
   'Neck limitations vary too much for pattern-level automation -- exercise-level tags (e.g. handstand push-up) still apply; the plan carries a review warning.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),

  -- Cardiovascular
  ('cardiovascular', 'manual_review', null, null,
   'A stated cardiovascular condition warrants clinician sign-off on vigorous exercise; the plan carries a review warning.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),
  ('cardiovascular', 'substitute', 'conditioning', 'bike',
   'Steady low-intensity aerobic work replaces high-intensity conditioning until vigorous intensities are cleared.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),

  -- Pregnancy / postpartum
  ('pregnancy_or_postpartum', 'manual_review', null, null,
   'Trimester/recovery stage determines what is appropriate -- the plan carries a review warning alongside the pattern exclusions below.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),
  ('pregnancy_or_postpartum', 'exclude', 'power', null,
   'High-impact jumping is generally avoided during pregnancy and early postpartum.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),
  ('pregnancy_or_postpartum', 'exclude', 'olympic_lift', null,
   'Maximal-effort explosive barbell work with breath-holding is generally avoided during pregnancy and early postpartum.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),
  ('pregnancy_or_postpartum', 'exclude', 'core_flexion', null,
   'Loaded trunk flexion stresses the abdominal wall during pregnancy and diastasis-recovery postpartum.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),
  ('pregnancy_or_postpartum', 'exclude', 'core_rotation', null,
   'Loaded trunk rotation stresses the abdominal wall during pregnancy and diastasis-recovery postpartum.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now()),

  -- Other (free-text limitation the taxonomy can't classify)
  ('other', 'manual_review', null, null,
   'An unclassifiable limitation can''t be automated -- the plan carries a prominent review warning instead of guessing.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'approved', now());

do $$
declare n integer; tags integer;
begin
  select count(*), count(distinct limitation_tag) into n, tags from public.limitation_rules where status = 'approved';
  if n < 24 or tags < 10 then
    raise exception 'limitation rules seed incomplete: % rules across % tags', n, tags;
  end if;
end $$;
