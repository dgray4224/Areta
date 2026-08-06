-- Expands exercise counts on the "full coverage" programs shipped in
-- 0049/0054-0059/0053 from their >=4-exercise floor up to an
-- archetype-specific target, researched per-archetype rather than one
-- blanket number (a follow-up user report: every strength session across
-- all 8 archetypes sat right at 4-5, never higher, because the original
-- spec only encoded "at least 4").
--
-- Not routed through the content-spec pipeline (content:add) -- like
-- 0045, this is structural data (more exercises in already-shipped,
-- already-cited sessions) rather than a new sourced methodology claim.
-- Research per archetype (WebSearch/WebFetch, 2026-08-06), averaged
-- across multiple specialists rather than one rigid philosophy per the
-- user's explicit request:
--
--   hypertrophy (ATHLEAN-X real routine, Nippard, Israetel/RP)        -> 7
--   long_distance_runner (TrainingPeaks explicit "6-8", Fitzgerald)   -> 8
--   general_fitness (general web consensus 4-6 intermediate, ACSM)    -> 6
--   hybrid_athlete (Viada ~3-4 minimalist, BoxRox 5x3, Tailored
--     Coaching Method 5-6 -- averaged, doesn't just defer to Viada)   -> 5
--   cyclist (roadmancycling 4-5, TrainerRoad ~5-6, Brodie explicit
--     4-6)                                                            -> 6
--   functional_fitness (CompTrain, Invictus -- no hard number
--     published either place; modest, lower-confidence increase)     -> 6
--   powerlifter (Westside 4-5, Sheiko 2-4, Wendler 5/3/1 1-3 --
--     already-active content is at/above this 3-specialist ceiling)  -> 5 (no change)
--   olympic_weightlifter (Catalyst 3-4+supplemental, Chinese system
--     4-5 -- already-active content already matches)                 -> 5 (near-no change)
--
-- Exercises added are either pulled directly from a cited specialist's
-- real published routine (ATHLEAN-X's actual Push/Pull/Legs exercise
-- lists; Catalyst's own jerk-day technique variation; the hybrid
-- sources' actual sample sessions) or reused from the existing exercise
-- library already tagged for that archetype -- no fabricated
-- specificity, per this pipeline's non-negotiable sourcing rule.

-- New program_sources citations for the two archetypes where new
-- specialist research directly drove the target count (hypertrophy,
-- cyclist, powerlifter, oly, functional_fitness, general_fitness kept
-- their existing citations -- the count either didn't move or the
-- addition only reuses that program's already-cited methodology).
insert into program_sources (program_id, organization, title, url, retrieved_at) values
  ('42bbb1d0-475c-4813-bf09-8e96d4a30983', 'BOXROX', '3 Hybrid Athlete Lifting Sessions That Improve Running Speed', 'https://www.boxrox.com/3-hybrid-athlete-lifting-sessions-that-improve-running-speed/', '2026-08-06'),
  ('42bbb1d0-475c-4813-bf09-8e96d4a30983', 'Tailored Coaching Method', 'Hybrid Training Program: Step-by-Step Guide to Strength & Running', 'https://tailoredcoachingmethod.com/hybrid-athlete-training-guide/', '2026-08-06'),
  ('09c32548-668f-4865-b953-b95ba957f249', 'TrainingPeaks', 'Strength Training Tips for Runners', 'https://www.trainingpeaks.com/blog/strength-trainig-tips-for-runners/', '2026-08-06');

-- ============================================================
-- hypertrophy-athleanx-ppl-full-coverage: 5 -> 7 per session,
-- both phases. Additions pulled from ATHLEAN-X's own real Push/Pull/Legs
-- exercise lists (already this program's cited source).
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  -- Push A (both phases)
  ('543738b3-d051-44e4-a263-a78cf98ddbf5', 6, (select id from exercises where name = 'Cable fly'), 3, 12, 15, 'rpe', '6', 'Chest isolation -- part of ATHLEAN-X''s real Push Day accessory work.'),
  ('543738b3-d051-44e4-a263-a78cf98ddbf5', 7, (select id from exercises where name = 'Overhead triceps extension'), 3, 10, 12, 'rpe', '6-7', 'Triceps stretch-position isolation to close the session.'),
  ('095af83f-046d-4419-97c3-05b6eac0023f', 6, (select id from exercises where name = 'Cable fly'), 3, 12, 15, 'rpe', '6', 'Chest isolation -- part of ATHLEAN-X''s real Push Day accessory work.'),
  ('095af83f-046d-4419-97c3-05b6eac0023f', 7, (select id from exercises where name = 'Overhead triceps extension'), 3, 10, 12, 'rpe', '6-7', 'Triceps stretch-position isolation to close the session.'),
  -- Pull A (both phases)
  ('2e2089b7-7da3-4bd4-96e1-55c67fc022ee', 6, (select id from exercises where name = 'Cable row'), 3, 10, 12, 'rpe', '7', 'Additional horizontal pull volume.'),
  ('2e2089b7-7da3-4bd4-96e1-55c67fc022ee', 7, (select id from exercises where name = 'Hammer curl'), 3, 10, 12, 'rpe', '6', 'Neutral-grip biceps/forearm work.'),
  ('16ac1ebf-c330-4f78-98bd-fcbce58b4827', 6, (select id from exercises where name = 'Cable row'), 3, 10, 12, 'rpe', '7', 'Additional horizontal pull volume.'),
  ('16ac1ebf-c330-4f78-98bd-fcbce58b4827', 7, (select id from exercises where name = 'Hammer curl'), 3, 10, 12, 'rpe', '6', 'Neutral-grip biceps/forearm work.'),
  -- Legs A (both phases)
  ('0df3b10f-297f-45e7-97ec-76d6e68883ce', 6, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '7', 'Quad volume without additional spinal loading after the squat pattern above.'),
  ('0df3b10f-297f-45e7-97ec-76d6e68883ce', 7, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6', 'Quad isolation to finish.'),
  ('7d7edc0f-4a65-4ae6-9d2d-c472792c2139', 6, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '7', 'Quad volume without additional spinal loading after the squat pattern above.'),
  ('7d7edc0f-4a65-4ae6-9d2d-c472792c2139', 7, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6', 'Quad isolation to finish.'),
  -- Push B (both phases)
  ('ba6ee862-9d73-4229-af48-ad918115f090', 6, (select id from exercises where name = 'Dumbbell lateral raise'), 3, 12, 15, 'rpe', '6', 'Shoulder isolation for width.'),
  ('ba6ee862-9d73-4229-af48-ad918115f090', 7, (select id from exercises where name = 'Triceps pushdown'), 3, 10, 12, 'rpe', '6-7', 'Triceps isolation to close the session.'),
  ('0b6205e3-9267-471d-bf60-0de431e94b27', 6, (select id from exercises where name = 'Dumbbell lateral raise'), 3, 12, 15, 'rpe', '6', 'Shoulder isolation for width.'),
  ('0b6205e3-9267-471d-bf60-0de431e94b27', 7, (select id from exercises where name = 'Triceps pushdown'), 3, 10, 12, 'rpe', '6-7', 'Triceps isolation to close the session.'),
  -- Pull B (both phases)
  ('ed5980b5-c2e9-4a05-b51a-c7b7e1683aff', 6, (select id from exercises where name = 'Barbell curl'), 3, 8, 10, 'rpe', '7', 'Heavier biceps compound to complement the accessory curl above.'),
  ('ed5980b5-c2e9-4a05-b51a-c7b7e1683aff', 7, (select id from exercises where name = 'Face pull'), 3, 12, 15, 'rpe', '6', 'Rear delt/rotator cuff health -- ATHLEAN-X''s recurring pull-day inclusion.'),
  ('b242a273-33fc-4ad5-a2f3-4fb6f66d6ee2', 6, (select id from exercises where name = 'Barbell curl'), 3, 8, 10, 'rpe', '7', 'Heavier biceps compound to complement the accessory curl above.'),
  ('b242a273-33fc-4ad5-a2f3-4fb6f66d6ee2', 7, (select id from exercises where name = 'Face pull'), 3, 12, 15, 'rpe', '6', 'Rear delt/rotator cuff health -- ATHLEAN-X''s recurring pull-day inclusion.'),
  -- Legs B (both phases)
  ('14a152fb-d876-496a-8f97-95e7f3e80104', 6, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '7', 'Quad volume without additional spinal loading after the squat pattern above.'),
  ('14a152fb-d876-496a-8f97-95e7f3e80104', 7, (select id from exercises where name = 'Seated leg curl'), 3, 10, 12, 'rpe', '6', 'Hamstring isolation to balance the session''s quad-dominant volume.'),
  ('983717e7-6a3d-430c-b334-e40a7617bdab', 6, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '7', 'Quad volume without additional spinal loading after the squat pattern above.'),
  ('983717e7-6a3d-430c-b334-e40a7617bdab', 7, (select id from exercises where name = 'Seated leg curl'), 3, 10, 12, 'rpe', '6', 'Hamstring isolation to balance the session''s quad-dominant volume.');

-- ============================================================
-- runner-daniels-five-pace-full-coverage: 5 -> 8 per session, both
-- phases. TrainingPeaks' explicit "6-8 exercises" is the only hard
-- number found for runner strength-support sessions; aiming at the top
-- of that explicit range per the user's stated preference.
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  ('c7d65f8c-1871-4e79-aec1-b4a97715b52d', 6, (select id from exercises where name = 'Side plank'), 3, 1, 1, 'none', null, '30-45 second holds per side -- lateral core/hip stability for running.'),
  ('c7d65f8c-1871-4e79-aec1-b4a97715b52d', 7, (select id from exercises where name = 'Dead bug'), 3, 8, 10, 'rpe', '5', 'Per side -- anti-extension core control for running posture under fatigue.'),
  ('c7d65f8c-1871-4e79-aec1-b4a97715b52d', 8, (select id from exercises where name = 'Reverse lunge'), 3, 8, 10, 'rpe', '6', 'Per leg -- single-leg strength for stride mechanics.'),
  ('763afba6-ab97-4ca9-9b15-5868a85014a0', 6, (select id from exercises where name = 'Side plank'), 3, 1, 1, 'none', null, '30-45 second holds per side -- lateral core/hip stability for running.'),
  ('763afba6-ab97-4ca9-9b15-5868a85014a0', 7, (select id from exercises where name = 'Dead bug'), 3, 8, 10, 'rpe', '5', 'Per side -- anti-extension core control for running posture under fatigue.'),
  ('763afba6-ab97-4ca9-9b15-5868a85014a0', 8, (select id from exercises where name = 'Reverse lunge'), 3, 8, 10, 'rpe', '6', 'Per leg -- single-leg strength for stride mechanics.');

-- ============================================================
-- general-fitness-circuit: 3 -> 6 exercises per circuit, all 3 phases.
-- Additions reuse exercises already tagged general_fitness in the
-- library; no single specialist gave a hard number here, so this stays
-- within the generically-supported 4-6 range rather than pushing to the
-- top of the hypertrophy/runner ranges.
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  -- Circuit A (all 3 phases)
  ('b7708d61-e75a-46a2-8760-0f4fb1f8d4cd', 4, (select id from exercises where name = 'Plank'), 2, 1, 1, 'none', null, '30-45 second holds, continue the circuit flow.'),
  ('b7708d61-e75a-46a2-8760-0f4fb1f8d4cd', 5, (select id from exercises where name = 'Dumbbell curl'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('b7708d61-e75a-46a2-8760-0f4fb1f8d4cd', 6, (select id from exercises where name = 'Farmer''s carry'), 2, 1, 1, 'none', null, '30-40 steps -- full-body carry to close the round.'),
  ('2ca17a42-78ec-472b-b969-a32d2071a919', 4, (select id from exercises where name = 'Plank'), 2, 1, 1, 'none', null, '30-45 second holds, continue the circuit flow.'),
  ('2ca17a42-78ec-472b-b969-a32d2071a919', 5, (select id from exercises where name = 'Dumbbell curl'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('2ca17a42-78ec-472b-b969-a32d2071a919', 6, (select id from exercises where name = 'Farmer''s carry'), 2, 1, 1, 'none', null, '30-40 steps -- full-body carry to close the round.'),
  ('0a41fb80-22d9-4bc8-914e-a7426090cadc', 4, (select id from exercises where name = 'Plank'), 2, 1, 1, 'none', null, '30-45 second holds, continue the circuit flow.'),
  ('0a41fb80-22d9-4bc8-914e-a7426090cadc', 5, (select id from exercises where name = 'Dumbbell curl'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('0a41fb80-22d9-4bc8-914e-a7426090cadc', 6, (select id from exercises where name = 'Farmer''s carry'), 2, 1, 1, 'none', null, '30-40 steps -- full-body carry to close the round.'),
  -- Circuit B (all 3 phases)
  ('11de8d7b-0871-4c97-93d3-65bebf58ca46', 4, (select id from exercises where name = 'Goblet squat'), 2, 12, 15, 'rpe', '6', 'Same circuit flow.'),
  ('11de8d7b-0871-4c97-93d3-65bebf58ca46', 5, (select id from exercises where name = 'Bench dip'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('11de8d7b-0871-4c97-93d3-65bebf58ca46', 6, (select id from exercises where name = 'Burpee'), 2, 10, 12, 'rpe', '7', 'Conditioning finisher for the round.'),
  ('ba4dde75-b420-41c3-80e3-af6f584fe9d2', 4, (select id from exercises where name = 'Goblet squat'), 2, 12, 15, 'rpe', '6', 'Same circuit flow.'),
  ('ba4dde75-b420-41c3-80e3-af6f584fe9d2', 5, (select id from exercises where name = 'Bench dip'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('ba4dde75-b420-41c3-80e3-af6f584fe9d2', 6, (select id from exercises where name = 'Burpee'), 2, 10, 12, 'rpe', '7', 'Conditioning finisher for the round.'),
  ('dd6f61c8-609b-41c4-9076-7d24af8ca2d3', 4, (select id from exercises where name = 'Goblet squat'), 2, 12, 15, 'rpe', '6', 'Same circuit flow.'),
  ('dd6f61c8-609b-41c4-9076-7d24af8ca2d3', 5, (select id from exercises where name = 'Bench dip'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('dd6f61c8-609b-41c4-9076-7d24af8ca2d3', 6, (select id from exercises where name = 'Burpee'), 2, 10, 12, 'rpe', '7', 'Conditioning finisher for the round.'),
  -- Circuit C (all 3 phases)
  ('ab47d96b-971a-4f9e-8368-22dc01159c66', 4, (select id from exercises where name = 'Suitcase carry'), 2, 1, 1, 'none', null, 'Per side, 30-40 steps.'),
  ('ab47d96b-971a-4f9e-8368-22dc01159c66', 5, (select id from exercises where name = 'Russian twist'), 2, 15, 20, 'rpe', '5', 'Rotational core to close the round.'),
  ('ab47d96b-971a-4f9e-8368-22dc01159c66', 6, (select id from exercises where name = 'Triceps pushdown'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('eaf8715f-bc0c-4fac-a3f0-9d4592555c87', 4, (select id from exercises where name = 'Suitcase carry'), 2, 1, 1, 'none', null, 'Per side, 30-40 steps.'),
  ('eaf8715f-bc0c-4fac-a3f0-9d4592555c87', 5, (select id from exercises where name = 'Russian twist'), 2, 15, 20, 'rpe', '5', 'Rotational core to close the round.'),
  ('eaf8715f-bc0c-4fac-a3f0-9d4592555c87', 6, (select id from exercises where name = 'Triceps pushdown'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
  ('55c16e12-6a1b-4584-b56e-8a0106ec7b6d', 4, (select id from exercises where name = 'Suitcase carry'), 2, 1, 1, 'none', null, 'Per side, 30-40 steps.'),
  ('55c16e12-6a1b-4584-b56e-8a0106ec7b6d', 5, (select id from exercises where name = 'Russian twist'), 2, 15, 20, 'rpe', '5', 'Rotational core to close the round.'),
  ('55c16e12-6a1b-4584-b56e-8a0106ec7b6d', 6, (select id from exercises where name = 'Triceps pushdown'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.');

-- ============================================================
-- cyclist-coggan-power-zones-full-coverage: 5 -> 6, both phases.
-- Leg extension is already tagged cyclist in the library (cycling-
-- specific quad emphasis), matching Brodie's explicit 4-6 range.
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  ('59cd7969-4cee-471c-8a0f-6b4fb601d374', 6, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6', 'Quad isolation -- cycling-specific accessory volume.'),
  ('84988484-5363-4a39-bdc4-f75a6c9781b8', 6, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6', 'Quad isolation -- cycling-specific accessory volume.');

-- ============================================================
-- functional-fitness-comptrain-full-coverage: 5 -> 6, both phases.
-- Modest increase (no hard specialist number found either at CompTrain
-- or Invictus) using exercises already tagged functional_fitness.
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  ('331616f7-caac-4544-a155-00662eec774d', 6, (select id from exercises where name = 'Farmer''s carry'), 3, 1, 1, 'none', null, 'Loaded carry -- CompTrain-style functional finisher.'),
  ('26875da0-b236-4264-8b3d-dd3d927d3e83', 6, (select id from exercises where name = 'Farmer''s carry'), 3, 1, 1, 'none', null, 'Loaded carry -- CompTrain-style functional finisher.'),
  ('950a174e-a4ee-47d4-8d92-8199cdecc061', 6, (select id from exercises where name = 'Ring dip'), 3, 6, 8, 'rpe', '7', 'Gymnastics pushing strength to round out the skill day.'),
  ('006f63f5-706f-4446-aa91-c7af1adf5b60', 6, (select id from exercises where name = 'Ring dip'), 3, 6, 8, 'rpe', '7', 'Gymnastics pushing strength to round out the skill day.'),
  ('bc74bc7a-d137-46ba-9d79-ee449259e5c0', 6, (select id from exercises where name = 'Thruster'), 4, 6, 8, 'rpe', '7', 'Squat-to-press power -- classic barbell conditioning movement.'),
  ('13bbb258-720d-45c5-9975-6693968b5660', 6, (select id from exercises where name = 'Thruster'), 4, 6, 8, 'rpe', '7', 'Squat-to-press power -- classic barbell conditioning movement.');

-- ============================================================
-- hybrid-full-coverage-concurrent: 4 -> 5, both phases. Averaged across
-- Viada (minimalist, ~3-4) and two hybrid-specific sources with real
-- 5-exercise sample sessions (BoxRox, Tailored Coaching Method) -- lands
-- at the multi-specialist mode of 5, not Viada's number alone and not
-- the 6-8 used elsewhere.
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  ('c13f7f1f-4267-4bab-ad64-3ebee0012341', 5, (select id from exercises where name = 'Farmer''s carry'), 3, 1, 1, 'none', null, 'Loaded carry -- full-body heavy-day finisher, matches BoxRox''s real Session 1.'),
  ('90c23174-96c1-4023-ae51-eb7299f12bd4', 5, (select id from exercises where name = 'Farmer''s carry'), 3, 1, 1, 'none', null, 'Loaded carry -- full-body heavy-day finisher, matches BoxRox''s real Session 1.'),
  ('4d8adbff-de5a-4eb0-863c-4046219f88d3', 5, (select id from exercises where name = 'Kettlebell swing'), 3, 15, 20, 'rpe', '6', 'Hip-hinge power at the day''s lighter relative load.'),
  ('5ab1779d-1415-4e2c-b33e-3175cdea0a44', 5, (select id from exercises where name = 'Kettlebell swing'), 3, 15, 20, 'rpe', '6', 'Hip-hinge power at the day''s lighter relative load.'),
  ('dc4a8426-782b-44de-95b0-2758825215de', 5, (select id from exercises where name = 'Kettlebell clean and press'), 3, 5, 6, 'rpe', '7', 'Full-body power complement to the day''s heavy lifts, per hand.'),
  ('0ceb6f2e-7955-4df5-a95d-6e0c46855cd0', 5, (select id from exercises where name = 'Kettlebell clean and press'), 3, 5, 6, 'rpe', '7', 'Full-body power complement to the day''s heavy lifts, per hand.');

-- ============================================================
-- oly-catalyst-full-coverage: Clean & Jerk Day 4 -> 5, both phases
-- (Snatch Day/Squat & Strength/Pulling & Technique already at 5, no
-- change). Split jerk is Catalyst Athletics' own jerk-variation
-- technique work, already in the library and tagged olympic_weightlifter.
-- ============================================================
insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
  ('96a3eb82-7386-48ce-90dd-4d2d59ad3168', 5, (select id from exercises where name = 'Split jerk'), 4, 2, 2, 'rpe', '7', 'Jerk-specific technique variation to round out the day.'),
  ('6a892411-8d61-403f-96cd-2a3ac205f5c7', 5, (select id from exercises where name = 'Split jerk'), 4, 2, 2, 'rpe', '7', 'Jerk-specific technique variation to round out the day.');

-- No changes to powerlifter-conjugate-full-coverage: Westside (4-5),
-- Sheiko (2-4), and Wendler 5/3/1 (1-3) all cluster at or below this
-- program's already-active 5 exercises/session -- raising it further
-- would exceed every specialist checked, not just Viada-style caution.
