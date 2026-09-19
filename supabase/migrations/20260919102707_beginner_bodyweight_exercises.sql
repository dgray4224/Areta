-- Beginner bodyweight exercises: closing the pull and hinge holes.
--
-- Onboarding lets someone answer "Home, no equipment" or "Outdoors",
-- which maps to equipment_required = {'Bodyweight only'}, and
-- "Not much, or just getting back", which pins difficulty to beginner
-- and never relaxes. That combination is ordinary, and before this
-- migration it drew from 19 exercises containing:
--
--   horizontal_pull   0
--   vertical_pull     0
--   hinge             0
--   glute_isolation   0
--   shoulder_isolation 0
--
-- Programming push, squat and plank with no pulling at all is not a thin
-- plan, it is an unbalanced one. This adds 15 movements, all genuinely
-- equipment-free, weighted toward the two missing patterns and toward
-- the gentlest progressions — the library had no push easier than a full
-- push-up and no squat easier than a full bodyweight squat, which also
-- matters for the "usable by a first-time older beginner" bar.
--
-- Vertical pull is deliberately still empty: there is no honest
-- bodyweight vertical pull without a bar or something to hang from, and
-- inventing one would be worse than the gap.
--
-- limitation_tags matter here: they feed the never-relaxed injury filter,
-- so anything loading a joint carries the tag that excludes it.
insert into exercises (
  name, canonical_name, aliases, movement_pattern, movement_patterns, archetype_tags, modality,
  unilateral, compound, primary_muscle_groups, secondary_muscle_groups, equipment_required,
  setup_requirements, limitation_tags, contraindication_notes, difficulty, instructions, status
)
select * from (values
  -- ---- pull: the hole ----------------------------------------------
  ('Prone Y raise', 'Prone Y raise', array[]::text[], 'horizontal pull', array['horizontal_pull'], array['general_fitness'], 'resistance',
   false, false, array['back','shoulders'], array[]::text[], array['Bodyweight only'],
   array[]::text[], array['shoulder','lower_back'], null,
   'beginner', 'Lie face down, arms overhead in a Y with thumbs up. Lift both arms a few inches by squeezing the shoulder blades down and back. Lower slowly. Keep the neck long and the forehead down.', 'active'),

  ('Prone T raise', 'Prone T raise', array[]::text[], 'horizontal pull', array['horizontal_pull'], array['general_fitness'], 'resistance',
   false, false, array['back','shoulders'], array[]::text[], array['Bodyweight only'],
   array[]::text[], array['shoulder','lower_back'], null,
   'beginner', 'Lie face down, arms straight out to the sides in a T with thumbs up. Squeeze the shoulder blades together to lift the arms. Lower under control. Move the arms, not the ribcage.', 'active'),

  ('Reverse snow angel', 'Reverse snow angel', array[]::text[], 'horizontal pull', array['horizontal_pull'], array['general_fitness'], 'resistance',
   false, false, array['back','shoulders'], array[]::text[], array['Bodyweight only'],
   array[]::text[], array['shoulder','lower_back'], null,
   'beginner', 'Lie face down with arms by your sides, palms down. Lift the hands slightly and sweep the arms overhead along the floor, then back. Keep the arms straight and the movement slow.', 'active'),

  ('Superman', 'Superman', array['Back extension hold']::text[], 'hinge', array['core_stability'], array['general_fitness'], 'resistance',
   false, false, array['back'], array['glutes'], array['Bodyweight only'],
   array[]::text[], array['lower_back','pregnancy_or_postpartum'], 'Ease off if it pinches the lower back; shorten the range rather than pushing through.',
   'beginner', 'Lie face down, arms ahead. Lift the chest, arms and thighs a small distance off the floor, hold briefly, lower. Aim for a long body, not a high lift.', 'active'),

  ('Towel row', 'Towel row', array['Self-resisted row']::text[], 'horizontal pull', array['horizontal_pull'], array['general_fitness'], 'resistance',
   false, true, array['back','biceps'], array[]::text[], array['Bodyweight only'],
   array['a towel or similar']::text[], array['shoulder','wrist_or_elbow'], null,
   'beginner', 'Hold a towel at both ends, arms ahead of you. Pull one hand toward your ribs while resisting with the other, pulling the shoulder blade back. Hold the tension, then swap sides.', 'active'),

  ('Doorway row', 'Doorway row', array['Door frame row']::text[], 'horizontal pull', array['horizontal_pull'], array['general_fitness'], 'resistance',
   false, true, array['back','biceps'], array['core'], array['Bodyweight only'],
   array['a sturdy doorframe']::text[], array['shoulder','wrist_or_elbow','lower_back'], 'Test the frame takes your weight before leaning back.',
   'beginner', 'Face a doorframe, grip both sides at chest height, feet close to it. Lean back with straight arms and a straight body, then pull yourself upright by driving the elbows back. The further forward the feet, the harder it gets.', 'active'),

  -- ---- hinge: the other hole ---------------------------------------
  ('Bodyweight good morning', 'Bodyweight good morning', array[]::text[], 'hinge', array['hinge'], array['general_fitness','hybrid_athlete'], 'resistance',
   false, true, array['hamstrings','glutes'], array['back'], array['Bodyweight only'],
   array[]::text[], array['lower_back'], null,
   'beginner', 'Stand with hands crossed on the chest, knees softly bent. Push the hips straight back and let the chest travel forward with a flat back until you feel the hamstrings. Drive the hips forward to stand.', 'active'),

  ('Single-leg Romanian deadlift', 'Single-leg Romanian deadlift', array['Single-leg RDL']::text[], 'hinge', array['hinge'], array['general_fitness','hybrid_athlete'], 'resistance',
   true, true, array['hamstrings','glutes'], array['core'], array['Bodyweight only'],
   array[]::text[], array['lower_back','ankle_or_foot'], 'Hold a wall or chair for balance until the pattern is steady.',
   'beginner', 'Stand on one leg with a soft knee. Hinge at the hip, reaching the free leg straight behind you as the chest lowers, keeping hips level. Return to standing. Balance is part of the exercise.', 'active'),

  -- ---- gentler entry points than anything that existed --------------
  ('Wall push-up', 'Wall push-up', array[]::text[], 'horizontal push', array['horizontal_push','incline_push'], array['general_fitness'], 'resistance',
   false, true, array['chest','shoulders'], array['triceps'], array['Bodyweight only'],
   array['a clear wall']::text[], array['wrist_or_elbow','shoulder'], null,
   'beginner', 'Stand arm''s length from a wall, hands flat at chest height. Bend the elbows to bring the chest toward the wall, then press away. Step the feet further back to make it harder.', 'active'),

  ('Knee push-up', 'Knee push-up', array['Modified push-up']::text[], 'horizontal push', array['horizontal_push'], array['general_fitness'], 'resistance',
   false, true, array['chest','triceps'], array['shoulders','core'], array['Bodyweight only'],
   array[]::text[], array['wrist_or_elbow','shoulder'], null,
   'beginner', 'Kneel with hands under the shoulders and a straight line from knees to head. Lower the chest toward the floor, then press back up. Keep the hips from sagging.', 'active'),

  ('Chair squat', 'Chair squat', array['Sit-to-stand','Box squat']::text[], 'squat', array['squat'], array['general_fitness'], 'resistance',
   false, true, array['quads','glutes'], array['core'], array['Bodyweight only'],
   array['a sturdy chair or bench']::text[], array['knee'], null,
   'beginner', 'Stand in front of a chair, feet shoulder-width. Sit the hips back and down until you touch the seat, then stand up. Touch lightly rather than dropping onto it.', 'active'),

  ('Step-up', 'Step-up', array[]::text[], 'lunge', array['lunge'], array['general_fitness','hybrid_athlete'], 'resistance',
   true, true, array['quads','glutes'], array['calves'], array['Bodyweight only'],
   array['a step or low box']::text[], array['knee','ankle_or_foot'], null,
   'beginner', 'Place one foot fully on a step. Drive through that heel to stand up onto it, then lower under control. Let the working leg do the work rather than pushing off the trailing foot.', 'active'),

  -- ---- isolation patterns that had no beginner bodyweight option ----
  ('Side-lying hip abduction', 'Side-lying hip abduction', array['Side leg raise']::text[], 'glute isolation', array['glute_isolation'], array['general_fitness'], 'resistance',
   true, false, array['glutes'], array[]::text[], array['Bodyweight only'],
   array[]::text[], array['hip'], null,
   'beginner', 'Lie on one side with legs stacked and straight. Lift the top leg toward the ceiling without letting the hips roll back, then lower slowly.', 'active'),

  ('Wall slide', 'Wall slide', array['Wall angel']::text[], 'shoulder isolation', array['shoulder_isolation'], array['general_fitness'], 'resistance',
   false, false, array['shoulders'], array['back'], array['Bodyweight only'],
   array['a clear wall']::text[], array['shoulder','neck'], null,
   'beginner', 'Stand with your back, head and arms against a wall, elbows bent at shoulder height. Slide the arms up overhead keeping contact, then back down. Stop where contact breaks.', 'active'),

  ('Standing calf raise', 'Standing calf raise', array[]::text[], 'calf raise', array['calf_raise'], array['general_fitness'], 'resistance',
   false, false, array['calves'], array[]::text[], array['Bodyweight only'],
   array[]::text[], array['ankle_or_foot'], null,
   'beginner', 'Stand tall with feet hip-width, rise onto the balls of both feet, pause at the top, lower slowly. Hold a wall for balance if needed.', 'active')
) as v(name, canonical_name, aliases, movement_pattern, movement_patterns, archetype_tags, modality,
       unilateral, compound, primary_muscle_groups, secondary_muscle_groups, equipment_required,
       setup_requirements, limitation_tags, contraindication_notes, difficulty, instructions, status)
where not exists (select 1 from exercises e where e.canonical_name = v.canonical_name);
