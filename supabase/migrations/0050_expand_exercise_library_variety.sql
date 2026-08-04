-- Expands thin muscle-group categories in the exercise library so the
-- mobile Exercise tab's "browse by muscle group" picker (the free-form
-- swap/add feature) has real variety instead of 1-2 options in several
-- categories. Purely additive -- new exercises table rows only, no
-- program/session/prescription content, so this does not go through the
-- content pipeline in docs/training-content-pipeline.md (that pipeline's
-- citation-verification and program-structure steps exist for
-- methodology claims and the program_session_exercises arity risk,
-- neither of which applies to plain exercise-library rows). Same 7-column
-- insert shape scripts/training-content/generate-migration.ts's
-- emitNewExercises() already uses for new exercises -- reviewed by hand,
-- not run through the pipeline.
--
-- Before: grip (1), glutes (1), hamstrings (2), core (3), chest (4),
-- shoulders (8), no dedicated arms or calves category.
-- After: every category has at least 4 exercises; new "arms" and
-- "calves" categories added.

-- canonical_name (added by migration 0044, backfilled from name for
-- existing rows, then set NOT NULL with no column default) and
-- movement_patterns (array mirror of movement_pattern, same migration)
-- aren't set explicitly per row below -- derived in the outer select
-- from the same values instead, so they can't drift from name/
-- movement_pattern by a copy-paste mistake across 30 rows.
insert into public.exercises
  (name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions, canonical_name, movement_patterns)
select name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions, name, array[movement_pattern]
from (values

  -- Grip (was: Farmer's carry only)
  ('Suitcase carry', 'loaded carry', array['Dumbbells', 'Kettlebells', 'Full gym access'], array['functional_fitness', 'general_fitness', 'hybrid_athlete'], 'beginner', array['grip', 'core'], 'Carry a single heavy dumbbell or kettlebell at your side for distance or time, resisting the urge to lean.'),
  ('Dead hang', 'grip / shoulder stability', array['Pull-up bar'], array['general_fitness', 'hybrid_athlete', 'functional_fitness'], 'beginner', array['grip', 'shoulders'], 'Hang from a pull-up bar with arms fully extended, holding for time.'),
  ('Plate pinch hold', 'grip isolation', array['Full gym access'], array['powerlifter', 'functional_fitness'], 'intermediate', array['grip'], 'Pinch two weight plates together smooth-side-out and hold for time.'),

  -- Glutes (was: Kettlebell swing only)
  ('Barbell hip thrust', 'hip extension', array['Barbell', 'Full gym access'], array['hypertrophy', 'general_fitness', 'hybrid_athlete'], 'intermediate', array['glutes', 'hamstrings'], 'Upper back braced on a bench, drive the hips up until the torso is level, squeeze the glutes at the top.'),
  ('Back extension', 'hip-dominant / posterior chain', array['Full gym access'], array['hypertrophy', 'powerlifter', 'general_fitness'], 'beginner', array['glutes', 'hamstrings', 'back'], 'Hinge at the hips over a 45-degree bench, lower under control, extend back to neutral.'),
  ('Cable kickback', 'hip extension isolation', array['Full gym access'], array['hypertrophy', 'general_fitness'], 'beginner', array['glutes'], 'Cable ankle cuff attached, kick one leg back and up against resistance, squeeze the glute at the top.'),
  ('Glute bridge', 'hip extension', array['Bodyweight only'], array['general_fitness', 'hybrid_athlete'], 'beginner', array['glutes', 'hamstrings'], 'Lie on your back with feet planted, drive the hips up by squeezing the glutes, lower under control.'),
  ('Single-leg hip thrust', 'unilateral hip extension', array['Bodyweight only', 'Full gym access'], array['hypertrophy', 'general_fitness'], 'intermediate', array['glutes', 'hamstrings'], 'Same setup as a hip thrust, one foot planted at a time, driving through the working leg.'),

  -- Hamstrings (was: Barbell deadlift, Dumbbell Romanian deadlift)
  ('Nordic curl', 'hamstring eccentric', array['Bodyweight only'], array['hybrid_athlete', 'functional_fitness'], 'advanced', array['hamstrings'], 'Kneeling with ankles anchored, lower the torso forward under control as slowly as possible, then push back up.'),
  ('Seated leg curl', 'knee flexion', array['Full gym access'], array['hypertrophy', 'general_fitness'], 'beginner', array['hamstrings'], 'Seated on the machine, curl the pad down and back by flexing the knees, control the return.'),
  ('Good morning', 'hip hinge', array['Barbell', 'Full gym access'], array['powerlifter', 'hypertrophy'], 'intermediate', array['hamstrings', 'back', 'glutes'], 'Bar on the back, hinge forward at the hips keeping a soft knee bend and a flat back, return to standing.'),
  ('Single-leg Romanian deadlift', 'unilateral hip hinge', array['Dumbbells'], array['general_fitness', 'hybrid_athlete', 'long_distance_runner'], 'intermediate', array['hamstrings', 'glutes'], 'Balance on one leg, hinge forward lowering the dumbbell while the back leg lifts behind you, return to standing.'),
  ('Reverse hyper', 'hip extension', array['Full gym access'], array['powerlifter'], 'intermediate', array['hamstrings', 'glutes', 'back'], 'Torso supported on a raised bench, swing the legs from hanging to parallel using the hips, control the descent.'),

  -- Core (was: Hanging leg raise, Plank, Toes-to-bar)
  ('Russian twist', 'rotational core', array['Bodyweight only', 'Dumbbells'], array['general_fitness', 'functional_fitness'], 'beginner', array['core'], 'Seated with feet lifted, rotate the torso side to side, tapping the floor beside each hip.'),
  ('Cable woodchop', 'rotational core', array['Full gym access'], array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'intermediate', array['core'], 'Pull the cable diagonally across the body from high to low (or low to high), rotating through the torso.'),
  ('Dead bug', 'core stability', array['Bodyweight only'], array['general_fitness', 'long_distance_runner'], 'beginner', array['core'], 'Lying on your back with arms and legs raised, extend the opposite arm and leg while keeping the lower back pressed to the floor.'),
  ('Ab wheel rollout', 'core anti-extension', array['Full gym access', 'Bodyweight only'], array['functional_fitness', 'hybrid_athlete'], 'advanced', array['core'], 'Kneeling, roll the wheel forward as far as control allows, brace the core to pull back to start.'),
  ('Side plank', 'core stability', array['Bodyweight only'], array['general_fitness', 'long_distance_runner'], 'beginner', array['core'], 'Forearm and feet stacked on the floor, hips lifted in a straight line, hold for time on each side.'),

  -- Chest (was: Barbell bench press, Dumbbell bench press, Push-up, Ring dip)
  ('Incline dumbbell bench press', 'incline push', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'beginner', array['chest', 'shoulders', 'arms'], 'On an incline bench, press dumbbells from shoulder height to lockout, lower under control.'),
  ('Cable fly', 'horizontal adduction isolation', array['Full gym access'], array['hypertrophy'], 'beginner', array['chest'], 'Cables set at chest height, sweep both handles together in front of the chest with a slight elbow bend.'),
  ('Decline barbell bench press', 'decline push', array['Barbell', 'Full gym access'], array['hypertrophy', 'powerlifter'], 'intermediate', array['chest', 'arms'], 'On a decline bench, lower the bar to the lower chest with control, press back up to lockout.'),

  -- Shoulders (was: 8 -- adding isolation work)
  ('Dumbbell lateral raise', 'shoulder abduction', array['Dumbbells'], array['hypertrophy', 'powerlifter', 'general_fitness'], 'beginner', array['shoulders'], 'Raise dumbbells out to the sides to shoulder height with a slight elbow bend, lower under control.'),
  ('Face pull', 'horizontal pull / rear delt', array['Full gym access'], array['hypertrophy', 'powerlifter', 'general_fitness'], 'beginner', array['shoulders', 'back'], 'Cable at face height, pull the rope toward the face flaring the elbows out, squeeze the rear delts.'),

  -- Arms (new category)
  ('Barbell curl', 'elbow flexion', array['Barbell', 'Full gym access'], array['hypertrophy', 'powerlifter'], 'beginner', array['arms'], 'Standing, curl the bar from thighs to shoulders keeping the elbows pinned at your sides, lower under control.'),
  ('Dumbbell curl', 'elbow flexion', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Standing or seated, curl the dumbbells to shoulder height keeping the elbows pinned at your sides.'),
  ('Hammer curl', 'elbow flexion, neutral grip', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Curl dumbbells with palms facing each other throughout the movement.'),
  ('Triceps pushdown', 'elbow extension', array['Full gym access'], array['hypertrophy', 'powerlifter', 'general_fitness'], 'beginner', array['arms'], 'Cable at chest height, push the bar or rope down to full elbow extension keeping the elbows pinned at your sides.'),
  ('Skull crusher', 'elbow extension', array['Barbell', 'Dumbbells'], array['hypertrophy', 'powerlifter'], 'intermediate', array['arms'], 'Lying on a bench, lower the bar or dumbbells toward the forehead by bending only the elbows, press back to lockout.'),

  -- Calves (new category)
  ('Standing calf raise', 'ankle plantarflexion', array['Full gym access'], array['hypertrophy'], 'beginner', array['calves'], 'Standing on the balls of your feet on a raised platform, rise up onto your toes and lower under control.'),
  ('Seated calf raise', 'ankle plantarflexion, bent knee', array['Full gym access'], array['hypertrophy', 'general_fitness'], 'beginner', array['calves'], 'Seated with knees bent under a padded lever, rise onto your toes and lower under control.')

) as t(name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions);
