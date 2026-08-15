-- Content-expansion 4e (2026-08-15): make Kettlebells a viable
-- full-workout pool (was squat/hinge/carry/grip only -- zero press or
-- pull) and add depth to the thinnest remaining movement patterns
-- (row, jump_rope, incline_push, core_anti_extension,
-- hamstring_isolation, power). Same hand-reviewed plain-library-rows
-- rationale as 0050/20260814130000 (no program/session content, so
-- the training-content pipeline's citation steps don't apply).
-- carry and glute_isolation remain thin (2 each) -- deliberately
-- deferred to a future batch, not addressed here.
insert into public.exercises
  (name, canonical_name, movement_pattern, movement_patterns, equipment_required, archetype_tags, difficulty,
   primary_muscle_groups, secondary_muscle_groups, modality, compound, unilateral, limitation_tags, instructions)
select name, name, movement_pattern, movement_patterns, equipment_required, archetype_tags, difficulty,
   primary_muscle_groups, secondary_muscle_groups,
   -- Extends 0089/20260814130000's convention: conditioning-first ->
   -- aerobic, power/olympic_lift-pattern -> power (matches how 0089
   -- tags Box jump, Sled push, Kettlebell clean and press, etc.),
   -- everything else -> resistance. Rowing-machine and jump-rope rows
   -- below list 'conditioning' first specifically so this CASE derives
   -- aerobic for them.
   case
     when movement_patterns[1] = 'conditioning' then 'aerobic'
     when 'power' = any(movement_patterns) or 'olympic_lift' = any(movement_patterns) then 'power'
     else 'resistance'
   end,
   compound, unilateral, limitation_tags, instructions
from (values

  -- ---------- Kettlebell: push ----------
  ('Kettlebell floor press', 'horizontal push', array['horizontal_push'], array['Kettlebells'],
   array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'beginner',
   array['chest'], array['triceps', 'shoulders'], true, false, array['shoulder', 'wrist_or_elbow'],
   'Lying on the floor with knees bent, press the kettlebell from chest height to lockout. The floor limits range of motion, protecting the shoulder.'),

  ('Kettlebell push press', 'vertical push', array['vertical_push'], array['Kettlebells'],
   array['functional_fitness', 'hybrid_athlete', 'general_fitness'], 'intermediate',
   array['shoulders'], array['triceps', 'quads'], true, true, array['shoulder', 'wrist_or_elbow'],
   'Kettlebell in the rack position, dip the knees slightly and drive up through the legs to press overhead. Work both sides.'),

  ('Single-arm kettlebell strict press', 'vertical push', array['vertical_push'], array['Kettlebells'],
   array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'intermediate',
   array['shoulders'], array['triceps', 'core'], true, true, array['shoulder', 'wrist_or_elbow'],
   'Kettlebell racked at the shoulder, press straight overhead without leaning back, keeping the ribs stacked over the hips. Work both sides.'),

  -- ---------- Kettlebell: pull ----------
  ('Single-arm kettlebell row', 'horizontal pull', array['horizontal_pull'], array['Kettlebells'],
   array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'beginner',
   array['back'], array['biceps'], true, true, array[]::text[],
   'Hinge at the hips with a flat back, one hand braced on a bench, and row the kettlebell to your ribs. Work both sides.'),

  ('Kettlebell renegade row', 'horizontal pull / anti-rotation core', array['horizontal_pull', 'core_anti_extension'], array['Kettlebells'],
   array['functional_fitness', 'hybrid_athlete'], 'advanced',
   array['back'], array['core', 'shoulders'], true, true, array['wrist_or_elbow', 'lower_back', 'shoulder'],
   'In a plank with a hand on each kettlebell, row one bell to your ribs while resisting hip rotation, then switch sides.'),

  -- ---------- Kettlebell: core ----------
  ('Kettlebell windmill', 'rotational core', array['core_rotation'], array['Kettlebells'],
   array['functional_fitness', 'hybrid_athlete'], 'advanced',
   array['core'], array['shoulders', 'hamstrings'], false, true, array['lower_back', 'shoulder', 'hip'],
   'Kettlebell locked out overhead, feet turned slightly away from that arm, hinge sideways to touch the floor with your free hand while keeping your eyes on the bell. Work both sides.'),

  ('Turkish get-up', 'full-body core stability', array['core_stability'], array['Kettlebells'],
   array['functional_fitness', 'hybrid_athlete', 'general_fitness'], 'advanced',
   array['core'], array['shoulders', 'glutes'], true, true, array['shoulder', 'lower_back', 'wrist_or_elbow'],
   'From lying down to standing while keeping the kettlebell locked out overhead the whole way, then reverse back to the floor under control. Work both sides.'),

  -- ---------- Kettlebell: isolation, squat, lunge ----------
  ('Kettlebell halo', 'shoulder isolation', array['shoulder_isolation'], array['Kettlebells'],
   array['general_fitness', 'functional_fitness'], 'beginner',
   array['shoulders'], array['core'], false, false, array['shoulder', 'neck'],
   'Hold the kettlebell by the horns at chest height and circle it around your head close to the skull, leading with the elbows. Alternate direction each set.'),

  ('Double kettlebell front rack squat', 'squat', array['squat'], array['Kettlebells'],
   array['general_fitness', 'hypertrophy', 'functional_fitness'], 'intermediate',
   array['quads'], array['glutes', 'core'], true, false, array['knee', 'wrist_or_elbow'],
   'Two kettlebells racked at the shoulders, elbows up, squat to depth keeping the torso upright, then drive back up.'),

  ('Kettlebell reverse lunge', 'lunge', array['lunge'], array['Kettlebells'],
   array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'intermediate',
   array['quads'], array['glutes', 'hamstrings'], true, true, array['knee'],
   'Kettlebell racked at one shoulder, step back into a reverse lunge until the back knee grazes the floor, then drive through the front heel to stand. Work both sides.'),

  -- ---------- Thin patterns: row (cardio-machine erg, distinct from kettlebell rowing above) ----------
  ('Rowing machine steady-state', 'rowing (aerobic)', array['conditioning', 'row'], array['Cardio machine', 'Full gym access'],
   array['long_distance_runner', 'general_fitness', 'triathlete'], 'beginner',
   array['back'], array['quads', 'hamstrings'], true, false, array['cardiovascular'],
   'Drive with the legs, finish with a lean-back and arm pull, then reverse the sequence to return -- steady, sustainable pace for time or distance.'),

  ('Rowing machine sprint intervals', 'rowing intervals', array['conditioning', 'row'], array['Cardio machine', 'Full gym access'],
   array['hybrid_athlete', 'functional_fitness', 'general_fitness'], 'intermediate',
   array['back'], array['quads', 'hamstrings'], true, false, array['cardiovascular'],
   'Alternate hard sprint intervals at max effort with easy paddling recovery, same leg-drive-then-pull technique throughout.'),

  -- ---------- Thin patterns: incline_push ----------
  ('Incline push-up', 'incline horizontal push', array['horizontal_push', 'incline_push'], array['Bodyweight only'],
   array['general_fitness'], 'beginner',
   array['chest'], array['triceps', 'shoulders'], true, false, array['wrist_or_elbow'],
   'Hands on a bench or step, body in a straight line, lower your chest to the surface and press back up. Easier than a floor push-up -- a good regression or high-rep option.'),

  ('Incline barbell bench press', 'incline horizontal push', array['horizontal_push', 'incline_push'], array['Barbell', 'Full gym access'],
   array['powerlifter', 'hypertrophy', 'general_fitness'], 'intermediate',
   array['chest'], array['shoulders', 'triceps'], true, false, array['shoulder'],
   'On an incline bench, lower the bar to the top of your chest and press back to lockout -- targets the upper chest more than a flat press.'),

  -- ---------- Thin patterns: core_anti_extension ----------
  ('Barbell rollout', 'anti-extension core', array['core_anti_extension'], array['Barbell', 'Full gym access'],
   array['functional_fitness', 'hybrid_athlete'], 'advanced',
   array['core'], array[]::text[], false, false, array['lower_back', 'wrist_or_elbow', 'pregnancy_or_postpartum'],
   'Kneeling, hands on a loaded barbell, roll it forward as far as you can control while keeping the lower back flat, then pull it back by bracing the abs, not the hips.'),

  ('Stability ball stir-the-pot', 'anti-rotation core', array['core_anti_extension'], array['Full gym access'],
   array['functional_fitness', 'general_fitness'], 'advanced',
   array['core'], array['shoulders'], false, false, array['lower_back', 'shoulder', 'wrist_or_elbow'],
   'Forearms on a stability ball in a plank, draw small circles with the ball using your forearms while keeping your hips level and still.'),

  -- ---------- Thin patterns: hamstring_isolation ----------
  ('Lying leg curl', 'hamstring isolation', array['hamstring_isolation'], array['Full gym access'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['hamstrings'], array[]::text[], false, false, array['knee'],
   'Face down on the machine, pad against your ankles, curl your heels toward your glutes and lower under control.'),

  ('Stability ball hamstring curl', 'hamstring isolation', array['hamstring_isolation'], array['Bodyweight only'],
   array['general_fitness', 'functional_fitness'], 'beginner',
   array['hamstrings'], array['glutes'], false, false, array['knee', 'lower_back'],
   'Lying on your back with heels on a stability ball, bridge your hips up and curl the ball toward your glutes, then roll it back out.'),

  -- ---------- Thin patterns: power ----------
  ('Broad jump', 'lower-body power', array['power'], array['Bodyweight only'],
   array['hybrid_athlete', 'functional_fitness', 'general_fitness'], 'intermediate',
   array['quads'], array['glutes', 'hamstrings'], true, false, array['knee', 'ankle_or_foot', 'pregnancy_or_postpartum'],
   'From a quarter-squat with an arm swing, jump forward for maximum distance and stick the landing before resetting.'),

  ('Dumbbell jump squat', 'lower-body power', array['power'], array['Dumbbells'],
   array['hybrid_athlete', 'general_fitness'], 'intermediate',
   array['quads'], array['glutes'], true, false, array['knee', 'ankle_or_foot', 'pregnancy_or_postpartum'],
   'Holding light dumbbells at your sides, squat down and explode upward into a jump, landing softly back into the squat.'),

  -- ---------- Thin patterns: jump_rope ----------
  ('Basic jump rope', 'conditioning', array['conditioning', 'jump_rope'], array['Bodyweight only'],
   array['general_fitness', 'long_distance_runner', 'hybrid_athlete'], 'beginner',
   array['calves'], array[]::text[], true, false, array['knee', 'ankle_or_foot', 'cardiovascular', 'pregnancy_or_postpartum'],
   'Steady single-bounce jumps turning the rope with your wrists, not your arms -- build up time before adding speed.'),

  ('Jump rope high-knees intervals', 'conditioning', array['conditioning', 'jump_rope'], array['Bodyweight only'],
   array['hybrid_athlete', 'functional_fitness', 'general_fitness'], 'intermediate',
   array['calves'], array['quads'], true, false, array['knee', 'ankle_or_foot', 'cardiovascular', 'pregnancy_or_postpartum'],
   'Jump rope while driving your knees up toward hip height each rep, in short high-effort intervals with rest between.')

) as v(name, movement_pattern, movement_patterns, equipment_required, archetype_tags, difficulty,
       primary_muscle_groups, secondary_muscle_groups, compound, unilateral, limitation_tags, instructions);
