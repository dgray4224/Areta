-- Follow-up to 0050: "arms" was a brand-new category with only 5
-- exercises (all curl/pushdown/skull-crusher). Adds 10 more real variety
-- covering different equipment, angles, and grip styles for biceps and
-- triceps, plus two bodyweight-only options for users without gym
-- equipment. Same reasoning as 0050 for bypassing the content pipeline --
-- plain exercise-library rows, no program/citation content.

insert into public.exercises
  (name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions, canonical_name, movement_patterns)
select name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions, name, array[movement_pattern]
from (values

  ('Preacher curl', 'elbow flexion, arm braced', array['Full gym access'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Arm braced against a preacher bench pad, curl the bar or dumbbell up while keeping the upper arm pinned, lower under full control.'),
  ('Concentration curl', 'elbow flexion, seated isolation', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Seated with the elbow braced against the inner thigh, curl the dumbbell up in a slow, controlled arc.'),
  ('Cable curl', 'elbow flexion', array['Full gym access'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Cable at the low pulley, curl the bar or handle up keeping the elbows pinned at your sides, lower under control.'),
  ('Incline dumbbell curl', 'elbow flexion, stretched position', array['Dumbbells'], array['hypertrophy'], 'intermediate', array['arms'], 'Seated on an incline bench with arms hanging straight down, curl the dumbbells up without letting the elbows drift forward.'),
  ('Zottman curl', 'elbow flexion, rotating grip', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'intermediate', array['arms'], 'Curl the dumbbells up with palms facing up, rotate the wrists at the top, then lower with palms facing down.'),

  ('Overhead triceps extension', 'elbow extension, overhead', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Holding a dumbbell overhead with both hands, lower it behind the head by bending only the elbows, press back to lockout.'),
  ('Close-grip bench press', 'horizontal push, narrow grip', array['Barbell', 'Full gym access'], array['hypertrophy', 'powerlifter'], 'intermediate', array['arms', 'chest'], 'Hands just inside shoulder width on the bar, lower to the chest keeping the elbows tucked, press back to lockout.'),
  ('Triceps kickback', 'elbow extension, hip-hinged', array['Dumbbells'], array['hypertrophy', 'general_fitness'], 'beginner', array['arms'], 'Hinged forward with the upper arm parallel to the floor, extend the elbow to kick the dumbbell back, control the return.'),
  ('Diamond push-up', 'horizontal push, narrow hand position', array['Bodyweight only'], array['general_fitness', 'hybrid_athlete', 'functional_fitness'], 'intermediate', array['arms', 'chest'], 'Hands together under the chest forming a diamond shape, lower the chest to the hands and press back up.'),
  ('Bench dip', 'elbow extension, bodyweight', array['Bodyweight only'], array['general_fitness', 'hybrid_athlete'], 'beginner', array['arms'], 'Hands on a bench behind you with legs extended, lower the hips toward the floor by bending the elbows, press back up.')

) as t(name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions);
