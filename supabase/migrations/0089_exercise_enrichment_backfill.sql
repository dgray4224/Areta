-- Backfills the goal-first enrichment columns migration 0044 added to
-- `exercises` but never populated (verified in production: 0 of 108
-- active rows had modality/limitation_tags/compound set). These columns
-- are what the goal-first recommendation engine
-- (domains/recommendation/*) filters and scores on; nothing else reads
-- them yet (legacy generation filters on archetype_tags only, the admin
-- editor merely displays them), so this backfill can't change any
-- existing behavior.
--
-- movement_patterns gets a NORMALIZED taxonomy (snake_case tokens),
-- distinct from the legacy free-text movement_pattern column which is
-- left untouched. Template slots (migration 0090+) reference these
-- tokens, so this list is the engine's matching vocabulary:
--   squat, hinge, lunge, hip_extension, horizontal_push, incline_push,
--   vertical_push, horizontal_pull, vertical_pull, elbow_flexion,
--   elbow_extension, shoulder_isolation, chest_isolation,
--   quad_isolation, hamstring_isolation, glute_isolation, calf_raise,
--   core_stability, core_flexion, core_rotation, core_anti_extension,
--   carry, grip, olympic_lift, power, conditioning, run, bike, swim,
--   row, jump_rope
--
-- limitation_tags semantics (matches domains/exercise/schema.ts
-- LIMITATION_TAGS): the limitations this exercise is UNSUITABLE for --
-- an intersection with the user's stated limitation tags excludes the
-- exercise before scoring (hard filter, mirroring limitation_rules'
-- action='exclude' doc comment in 0044). Tagging here is deliberately
-- conservative-for-safety: a tag means "someone who flagged this body
-- area should not be handed this exercise by default", not "this
-- exercise is universally dangerous".

-- ============================================================
-- Cardio: running
-- ============================================================
update public.exercises set
  modality = 'aerobic', movement_patterns = array['run'], compound = true,
  limitation_tags = array['knee','ankle_or_foot']
  where name in ('Easy-pace run', 'Brick run');

update public.exercises set
  modality = 'aerobic', movement_patterns = array['run','conditioning'], compound = true,
  limitation_tags = array['knee','ankle_or_foot','cardiovascular']
  where name in ('Tempo run', 'Track interval repeats');

update public.exercises set
  modality = 'aerobic', movement_patterns = array['run','conditioning'], compound = true,
  limitation_tags = array['knee','ankle_or_foot','cardiovascular','pregnancy_or_postpartum']
  where name in ('Track speed repetitions', 'Treadmill intervals');

-- ============================================================
-- Cardio: cycling (low-impact -- no knee/ankle exclusion by default)
-- ============================================================
update public.exercises set
  modality = 'aerobic', movement_patterns = array['bike'], compound = true
  where name in ('Long endurance ride', 'Stationary bike steady-state');

update public.exercises set
  modality = 'aerobic', movement_patterns = array['bike'], compound = true, unilateral = true
  where name = 'Single-leg pedal drills';

update public.exercises set
  modality = 'aerobic', movement_patterns = array['bike','conditioning'], compound = true,
  limitation_tags = array['cardiovascular']
  where name in ('Cycling hill repeats', 'Cycling threshold intervals');

update public.exercises set
  modality = 'aerobic', movement_patterns = array['bike','conditioning'], compound = true,
  limitation_tags = array['cardiovascular','pregnancy_or_postpartum']
  where name in ('Assault bike sprints', 'Standing bike sprints');

-- ============================================================
-- Cardio: swim / row / jump rope
-- ============================================================
update public.exercises set
  modality = 'aerobic', movement_patterns = array['swim'], compound = true,
  limitation_tags = array['shoulder']
  where name in ('Freestyle technique drill', 'Steady-state swim');

update public.exercises set
  modality = 'aerobic', movement_patterns = array['swim','conditioning'], compound = true,
  limitation_tags = array['shoulder','cardiovascular']
  where name = 'Swim intervals';

update public.exercises set
  modality = 'aerobic', movement_patterns = array['row','conditioning'], compound = true,
  secondary_muscle_groups = array['back','legs'],
  limitation_tags = array['cardiovascular']
  where name = 'Rowing intervals';

update public.exercises set
  modality = 'aerobic', movement_patterns = array['jump_rope','conditioning'], compound = true,
  limitation_tags = array['knee','ankle_or_foot','cardiovascular','pregnancy_or_postpartum']
  where name = 'Double-unders';

-- ============================================================
-- Mixed conditioning
-- ============================================================
update public.exercises set
  modality = 'aerobic', movement_patterns = array['conditioning'], compound = true,
  limitation_tags = array['wrist_or_elbow','cardiovascular','pregnancy_or_postpartum']
  where name = 'Burpee';

update public.exercises set
  modality = 'aerobic', movement_patterns = array['conditioning','hinge','vertical_push'], compound = true,
  limitation_tags = array['lower_back','shoulder','cardiovascular','pregnancy_or_postpartum']
  where name = 'Devil press';

-- ============================================================
-- Squat pattern
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['squat'], compound = true,
  secondary_muscle_groups = array['core'],
  limitation_tags = array['lower_back','knee','hip','pregnancy_or_postpartum']
  where name = 'Barbell back squat';

update public.exercises set
  modality = 'resistance', movement_patterns = array['squat'], compound = true,
  secondary_muscle_groups = array['core'],
  limitation_tags = array['knee','hip','wrist_or_elbow']
  where name = 'Front squat';

update public.exercises set
  modality = 'resistance', movement_patterns = array['squat'], compound = true,
  limitation_tags = array['knee','hip']
  where name in ('Goblet squat', 'Leg press');

update public.exercises set
  modality = 'resistance', movement_patterns = array['squat'], compound = true
  where name = 'Bodyweight squat';

update public.exercises set
  modality = 'resistance', movement_patterns = array['squat','olympic_lift'], compound = true,
  secondary_muscle_groups = array['shoulders','core'],
  limitation_tags = array['lower_back','knee','hip','shoulder','pregnancy_or_postpartum']
  where name = 'Overhead squat';

update public.exercises set
  modality = 'resistance', movement_patterns = array['squat','vertical_push','conditioning'], compound = true,
  limitation_tags = array['knee','shoulder','cardiovascular','pregnancy_or_postpartum']
  where name = 'Thruster';

update public.exercises set
  modality = 'resistance', movement_patterns = array['squat','conditioning'], compound = true,
  limitation_tags = array['knee','shoulder','cardiovascular']
  where name = 'Wall ball shot';

-- ============================================================
-- Hinge pattern
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['hinge'], compound = true,
  secondary_muscle_groups = array['core','grip'],
  limitation_tags = array['lower_back','pregnancy_or_postpartum']
  where name in ('Barbell deadlift', 'Good morning');

update public.exercises set
  modality = 'resistance', movement_patterns = array['hinge'], compound = true,
  secondary_muscle_groups = array['grip']
  where name = 'Dumbbell Romanian deadlift';

update public.exercises set
  modality = 'resistance', movement_patterns = array['hinge','conditioning'], compound = true,
  secondary_muscle_groups = array['grip'],
  limitation_tags = array['lower_back','cardiovascular']
  where name = 'Kettlebell swing';

update public.exercises set
  modality = 'power', movement_patterns = array['hinge','olympic_lift'], compound = true,
  secondary_muscle_groups = array['grip'],
  limitation_tags = array['lower_back','pregnancy_or_postpartum']
  where name in ('Clean pull', 'Snatch pull');

update public.exercises set
  modality = 'resistance', movement_patterns = array['hinge'], compound = true, unilateral = true,
  secondary_muscle_groups = array['core']
  where name = 'Single-leg Romanian deadlift';

-- ============================================================
-- Lunge / single-leg pattern
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['lunge'], compound = true, unilateral = true,
  limitation_tags = array['knee','hip']
  where name = 'Bulgarian split squat';

update public.exercises set
  modality = 'resistance', movement_patterns = array['lunge'], compound = true, unilateral = true,
  limitation_tags = array['knee']
  where name = 'Reverse lunge';

-- ============================================================
-- Hip extension
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['hip_extension'], compound = true
  where name in ('Barbell hip thrust', 'Glute bridge');

update public.exercises set
  modality = 'resistance', movement_patterns = array['hip_extension'], compound = true, unilateral = true
  where name = 'Single-leg hip thrust';

update public.exercises set
  modality = 'resistance', movement_patterns = array['hip_extension'], compound = true,
  limitation_tags = array['pregnancy_or_postpartum']
  where name = 'Reverse hyper';

update public.exercises set
  modality = 'resistance', movement_patterns = array['hip_extension'], compound = true
  where name = 'Back extension';

update public.exercises set
  modality = 'resistance', movement_patterns = array['glute_isolation'], compound = false
  where name = 'Cable kickback';

-- ============================================================
-- Horizontal push
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_push'], compound = true,
  secondary_muscle_groups = array['core'],
  limitation_tags = array['shoulder']
  where name in ('Barbell bench press', 'Dumbbell bench press', 'Decline barbell bench press');

update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_push'], compound = true,
  secondary_muscle_groups = array['core'],
  limitation_tags = array['wrist_or_elbow']
  where name = 'Push-up';

update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_push','incline_push'], compound = true,
  limitation_tags = array['shoulder']
  where name = 'Incline dumbbell bench press';

update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_push','elbow_extension'], compound = true,
  limitation_tags = array['shoulder','wrist_or_elbow']
  where name in ('Close-grip bench press', 'Diamond push-up');

update public.exercises set
  modality = 'resistance', movement_patterns = array['vertical_push'], compound = true,
  limitation_tags = array['shoulder','wrist_or_elbow']
  where name = 'Ring dip';

-- ============================================================
-- Vertical push
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['vertical_push'], compound = true,
  secondary_muscle_groups = array['core'],
  limitation_tags = array['shoulder']
  where name in ('Barbell overhead press', 'Dumbbell shoulder press', 'Push press');

update public.exercises set
  modality = 'resistance', movement_patterns = array['vertical_push'], compound = true,
  limitation_tags = array['shoulder','wrist_or_elbow','neck','pregnancy_or_postpartum']
  where name = 'Handstand push-up';

update public.exercises set
  modality = 'power', movement_patterns = array['vertical_push','olympic_lift'], compound = true,
  limitation_tags = array['shoulder','lower_back','pregnancy_or_postpartum']
  where name = 'Split jerk';

-- ============================================================
-- Horizontal pull
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_pull'], compound = true,
  secondary_muscle_groups = array['core','grip'],
  limitation_tags = array['lower_back']
  where name = 'Barbell row';

update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_pull'], compound = true,
  secondary_muscle_groups = array['grip']
  where name = 'Cable row';

update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_pull'], compound = true, unilateral = true,
  secondary_muscle_groups = array['grip','core']
  where name = 'Dumbbell row';

update public.exercises set
  modality = 'resistance', movement_patterns = array['horizontal_pull','shoulder_isolation'], compound = false
  where name = 'Face pull';

-- ============================================================
-- Vertical pull
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['vertical_pull'], compound = true,
  secondary_muscle_groups = array['grip','core'],
  limitation_tags = array['shoulder']
  where name in ('Pull-up', 'Chin-up');

update public.exercises set
  modality = 'resistance', movement_patterns = array['vertical_pull'], compound = true,
  limitation_tags = array['shoulder']
  where name = 'Lat pulldown';

update public.exercises set
  modality = 'resistance', movement_patterns = array['vertical_pull'], compound = true,
  secondary_muscle_groups = array['grip','core'],
  limitation_tags = array['shoulder','wrist_or_elbow','pregnancy_or_postpartum']
  where name in ('Chest-to-bar pull-up', 'Rope climb', 'Muscle-up');

-- ============================================================
-- Olympic lifts
-- ============================================================
update public.exercises set
  modality = 'power', movement_patterns = array['olympic_lift'], compound = true,
  secondary_muscle_groups = array['core','grip'],
  limitation_tags = array['lower_back','shoulder','wrist_or_elbow','pregnancy_or_postpartum']
  where name in (
    'Clean and jerk', 'Hang clean', 'Hang snatch', 'Power clean',
    'Power snatch', 'Snatch', 'Snatch balance', 'Kettlebell clean and press'
  );

-- ============================================================
-- Power / plyometric
-- ============================================================
update public.exercises set
  modality = 'power', movement_patterns = array['power'], compound = true,
  limitation_tags = array['knee','ankle_or_foot','pregnancy_or_postpartum']
  where name = 'Box jump';

update public.exercises set
  modality = 'power', movement_patterns = array['power','conditioning'], compound = true,
  limitation_tags = array['cardiovascular']
  where name = 'Sled push';

-- ============================================================
-- Arm isolation
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['elbow_flexion'], compound = false
  where name in (
    'Barbell curl', 'Cable curl', 'Dumbbell curl', 'Preacher curl',
    'Hammer curl', 'Zottman curl', 'Incline dumbbell curl'
  );

update public.exercises set
  modality = 'resistance', movement_patterns = array['elbow_flexion'], compound = false, unilateral = true
  where name = 'Concentration curl';

update public.exercises set
  modality = 'resistance', movement_patterns = array['elbow_extension'], compound = false,
  limitation_tags = array['wrist_or_elbow']
  where name in ('Skull crusher', 'Bench dip');

update public.exercises set
  modality = 'resistance', movement_patterns = array['elbow_extension'], compound = false
  where name in ('Triceps pushdown', 'Triceps kickback', 'Overhead triceps extension');

-- ============================================================
-- Shoulder / chest / leg isolation
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['shoulder_isolation'], compound = false,
  limitation_tags = array['shoulder']
  where name = 'Dumbbell lateral raise';

update public.exercises set
  modality = 'resistance', movement_patterns = array['chest_isolation'], compound = false
  where name = 'Cable fly';

update public.exercises set
  modality = 'resistance', movement_patterns = array['quad_isolation'], compound = false,
  limitation_tags = array['knee']
  where name = 'Leg extension';

update public.exercises set
  modality = 'resistance', movement_patterns = array['hamstring_isolation'], compound = false
  where name = 'Seated leg curl';

update public.exercises set
  modality = 'resistance', movement_patterns = array['hamstring_isolation'], compound = false,
  limitation_tags = array['knee']
  where name = 'Nordic curl';

update public.exercises set
  modality = 'resistance', movement_patterns = array['calf_raise'], compound = false
  where name in ('Standing calf raise', 'Seated calf raise');

-- ============================================================
-- Core
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['core_stability'], compound = false
  where name in ('Plank', 'Dead bug');

update public.exercises set
  modality = 'resistance', movement_patterns = array['core_stability'], compound = false, unilateral = true
  where name = 'Side plank';

update public.exercises set
  modality = 'resistance', movement_patterns = array['core_anti_extension'], compound = false,
  limitation_tags = array['lower_back','wrist_or_elbow','pregnancy_or_postpartum']
  where name = 'Ab wheel rollout';

update public.exercises set
  modality = 'resistance', movement_patterns = array['core_flexion'], compound = false,
  secondary_muscle_groups = array['grip'],
  limitation_tags = array['shoulder','pregnancy_or_postpartum']
  where name in ('Hanging leg raise', 'Toes-to-bar');

update public.exercises set
  modality = 'resistance', movement_patterns = array['core_rotation'], compound = false,
  limitation_tags = array['lower_back','pregnancy_or_postpartum']
  where name = 'Russian twist';

update public.exercises set
  modality = 'resistance', movement_patterns = array['core_rotation'], compound = false
  where name = 'Cable woodchop';

-- ============================================================
-- Carries / grip
-- ============================================================
update public.exercises set
  modality = 'resistance', movement_patterns = array['carry'], compound = true
  where name = 'Farmer''s carry';

update public.exercises set
  modality = 'resistance', movement_patterns = array['carry'], compound = true, unilateral = true,
  secondary_muscle_groups = array['core']
  where name = 'Suitcase carry';

update public.exercises set
  modality = 'resistance', movement_patterns = array['grip'], compound = false,
  limitation_tags = array['shoulder']
  where name = 'Dead hang';

update public.exercises set
  modality = 'resistance', movement_patterns = array['grip'], compound = false
  where name = 'Plate pinch hold';

-- ============================================================
-- Sanity check: every active exercise must now have a modality and at
-- least one normalized movement pattern. Fails the migration loudly if
-- a future rename left a row uncovered.
-- ============================================================
do $$
declare
  uncovered integer;
begin
  select count(*) into uncovered
  from public.exercises
  where status = 'active' and (modality is null or movement_patterns = '{}');
  if uncovered > 0 then
    raise exception 'exercise enrichment backfill left % active exercise(s) uncovered', uncovered;
  end if;
end $$;
