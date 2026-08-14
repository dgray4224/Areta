-- Content-expansion 4c (2026-08-14): widen the exercise library along the
-- two axes users actually feel:
--
--  1. STYLE / equipment depth — first "Resistance bands" and dedicated
--     "Cable machine" entries (the equipment vocabulary was 7 values with
--     zero band exercises), so home_basic_equipment and band-only users
--     get real pools for the high-demand patterns (horizontal_push 524
--     template-slot demand, horizontal_pull, conditioning) instead of
--     near-empty ones.
--  2. THIN movement patterns — core_flexion (12 library entries),
--     grip (16), quad_isolation (20), chest_isolation (24), calf_raise
--     (24) are the patterns the 252 program templates most visibly
--     repeat; each gets several additions here.
--
-- Same hand-reviewed plain-library-rows rationale as
-- 0050_expand_exercise_library_variety.sql (no program/session content,
-- so the training-content pipeline's citation steps don't apply).
-- movement_patterns uses 0089's normalized taxonomy tokens; limitation
-- tags follow 0089's conservative-for-safety semantics.
insert into public.exercises
  (name, canonical_name, movement_pattern, movement_patterns, equipment_required, archetype_tags, difficulty,
   primary_muscle_groups, secondary_muscle_groups, modality, compound, unilateral, limitation_tags, instructions)
select name, name, movement_pattern, movement_patterns, equipment_required, archetype_tags, difficulty,
   primary_muscle_groups, secondary_muscle_groups,
   -- Matches 0089's convention: conditioning-first exercises are modality
   -- 'aerobic' (Burpee, Assault bike sprints), everything else here is
   -- plain resistance work.
   case when movement_patterns[1] = 'conditioning' then 'aerobic' else 'resistance' end,
   compound, unilateral, limitation_tags, instructions
from (values

  -- ---------- Resistance bands (new equipment value) ----------
  ('Band chest press', 'horizontal push', array['horizontal_push'], array['Resistance bands'],
   array['general_fitness', 'hypertrophy', 'hybrid_athlete'], 'beginner',
   array['chest'], array['triceps', 'shoulders'], true, false, array[]::text[],
   'Anchor the band behind you at chest height, one handle in each hand, and press forward until your arms are extended. Control the return.'),
  ('Band row', 'horizontal pull', array['horizontal_pull'], array['Resistance bands'],
   array['general_fitness', 'hybrid_athlete', 'functional_fitness'], 'beginner',
   array['back'], array['biceps'], true, false, array[]::text[],
   'Anchor the band at chest height, step back until it is taut, and pull the handles to your ribs with elbows close to your body.'),
  ('Band lat pulldown', 'vertical pull', array['vertical_pull'], array['Resistance bands'],
   array['general_fitness', 'hypertrophy'], 'beginner',
   array['back'], array['biceps'], true, false, array[]::text[],
   'Anchor the band overhead, kneel or sit tall, and pull the handles down to your collarbones, squeezing the lats.'),
  ('Band overhead press', 'vertical push', array['vertical_push'], array['Resistance bands'],
   array['general_fitness', 'hybrid_athlete'], 'beginner',
   array['shoulders'], array['triceps'], true, false, array['shoulder'],
   'Stand on the band, bring the handles to shoulder height, and press straight overhead without arching the lower back.'),
  ('Band chest fly', 'chest isolation', array['chest_isolation'], array['Resistance bands'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['chest'], array[]::text[], false, false, array[]::text[],
   'Anchor the band behind you at chest height and bring both handles together in a wide hugging arc, arms slightly bent.'),
  ('Band biceps curl', 'elbow flexion', array['elbow_flexion'], array['Resistance bands'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['biceps'], array[]::text[], false, false, array[]::text[],
   'Stand on the middle of the band, curl the handles to your shoulders keeping elbows pinned at your sides.'),
  ('Band triceps pushdown', 'elbow extension', array['elbow_extension'], array['Resistance bands'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['triceps'], array[]::text[], false, false, array[]::text[],
   'Anchor the band overhead, elbows pinned at your sides, and press the handles down until your arms are straight.'),
  ('Band pull-through', 'hip extension', array['hip_extension'], array['Resistance bands'],
   array['general_fitness', 'hypertrophy', 'functional_fitness'], 'beginner',
   array['glutes'], array['hamstrings'], true, false, array[]::text[],
   'Anchor the band low behind you, face away holding it between your legs, hinge at the hips and stand tall by squeezing the glutes.'),
  ('Band lateral walk', 'glute isolation', array['glute_isolation'], array['Resistance bands'],
   array['general_fitness', 'long_distance_runner', 'cyclist'], 'beginner',
   array['glutes'], array[]::text[], false, false, array[]::text[],
   'Loop the band just above your knees, sit into a quarter squat, and take controlled steps sideways keeping tension on the band.'),
  ('Band pull-apart', 'shoulder isolation', array['shoulder_isolation'], array['Resistance bands'],
   array['general_fitness', 'powerlifter', 'hybrid_athlete'], 'beginner',
   array['shoulders'], array['back'], false, false, array[]::text[],
   'Hold the band at shoulder height with straight arms and pull it apart until it touches your chest, squeezing the rear delts.'),
  ('Pallof press', 'anti-rotation core', array['core_stability'], array['Resistance bands', 'Cable machine', 'Full gym access'],
   array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'beginner',
   array['core'], array[]::text[], false, true, array[]::text[],
   'Anchor the band at chest height to your side, press it straight out in front of your chest and resist the pull to rotate. Work both sides.'),
  ('Spanish squat', 'quad isolation', array['quad_isolation'], array['Resistance bands'],
   array['general_fitness', 'hypertrophy', 'cyclist'], 'intermediate',
   array['quads'], array['glutes'], false, false, array[]::text[],
   'Loop a heavy band behind your knees anchored in front of you, sit back into a squat keeping shins vertical, and drive back up.'),

  -- ---------- Cable machine (new dedicated equipment value) ----------
  ('Cable crunch', 'core flexion', array['core_flexion'], array['Cable machine', 'Full gym access'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['core'], array[]::text[], false, false, array['pregnancy_or_postpartum'],
   'Kneel below a high cable with the rope behind your head and crunch your elbows toward your thighs, flexing the abs, not the hips.'),
  ('Cable lateral raise', 'shoulder isolation', array['shoulder_isolation'], array['Cable machine', 'Full gym access'],
   array['hypertrophy'], 'intermediate',
   array['shoulders'], array[]::text[], false, true, array['shoulder'],
   'Stand side-on to a low cable, raise the handle out to shoulder height with a soft elbow, and lower under control. Work both sides.'),

  -- ---------- Thin patterns: core_flexion ----------
  ('V-up', 'core flexion', array['core_flexion'], array['Bodyweight only'],
   array['functional_fitness', 'general_fitness', 'hybrid_athlete'], 'intermediate',
   array['core'], array[]::text[], false, false, array['lower_back', 'pregnancy_or_postpartum'],
   'Lying flat, lift your legs and torso simultaneously to touch your toes at the top, forming a V, then lower under control.'),
  ('Weighted crunch', 'core flexion', array['core_flexion'], array['Dumbbells', 'Full gym access'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['core'], array[]::text[], false, false, array['pregnancy_or_postpartum'],
   'Hold a plate or dumbbell on your chest and crunch your shoulder blades off the floor, exhaling at the top.'),

  -- ---------- Thin patterns: grip ----------
  ('Wrist curl', 'grip / forearm', array['grip'], array['Dumbbells', 'Barbell', 'Full gym access'],
   array['powerlifter', 'general_fitness'], 'beginner',
   array['grip'], array[]::text[], false, false, array['wrist_or_elbow'],
   'Forearms resting on a bench or your thighs, palms up, curl the weight with your wrists only.'),
  ('Towel dead hang', 'grip', array['grip'], array['Pull-up bar'],
   array['functional_fitness', 'hybrid_athlete'], 'intermediate',
   array['grip'], array['shoulders'], false, false, array['shoulder'],
   'Drape a towel over a pull-up bar, grip both ends, and hang for time — far harder on the grip than a bare-bar hang.'),
  ('Bottoms-up kettlebell hold', 'grip / shoulder stability', array['grip'], array['Kettlebells'],
   array['functional_fitness', 'general_fitness'], 'intermediate',
   array['grip'], array['shoulders'], false, true, array[]::text[],
   'Hold a kettlebell upside-down by the handle at shoulder height and keep it perfectly still. Work both sides.'),

  -- ---------- Thin patterns: quad_isolation ----------
  ('Sissy squat', 'quad isolation', array['quad_isolation'], array['Bodyweight only'],
   array['hypertrophy'], 'advanced',
   array['quads'], array[]::text[], false, false, array['knee'],
   'Heels down, lean the torso back and drive the knees forward as you lower, keeping hips extended, then pull back up with the quads.'),
  ('Wall sit', 'isometric quad hold', array['quad_isolation'], array['Bodyweight only'],
   array['general_fitness', 'long_distance_runner'], 'beginner',
   array['quads'], array['glutes'], false, false, array[]::text[],
   'Back flat against a wall, thighs parallel to the floor, hold for time.'),

  -- ---------- Thin patterns: chest_isolation ----------
  ('Dumbbell fly', 'chest isolation', array['chest_isolation'], array['Dumbbells', 'Full gym access'],
   array['hypertrophy'], 'intermediate',
   array['chest'], array[]::text[], false, false, array['shoulder'],
   'Lying on a bench with a dumbbell in each hand, lower the weights out in a wide arc with soft elbows, then squeeze them back together.'),
  ('Pec deck fly', 'chest isolation', array['chest_isolation'], array['Full gym access'],
   array['hypertrophy', 'general_fitness'], 'beginner',
   array['chest'], array[]::text[], false, false, array[]::text[],
   'Seated on the machine with forearms or hands on the pads, bring the arms together in front of your chest and control the return.'),

  -- ---------- Thin patterns: calf_raise ----------
  ('Single-leg calf raise', 'calf raise', array['calf_raise'], array['Bodyweight only'],
   array['general_fitness', 'long_distance_runner', 'hybrid_athlete'], 'beginner',
   array['calves'], array[]::text[], false, true, array['ankle_or_foot'],
   'On one foot, ball of the foot on a step, rise as high as possible and lower the heel below the step under control.'),
  ('Donkey calf raise', 'calf raise', array['calf_raise'], array['Full gym access'],
   array['hypertrophy'], 'intermediate',
   array['calves'], array[]::text[], false, false, array[]::text[],
   'Hinged at the hips on the machine (or with a partner/plate load), drive up onto the balls of your feet through a full stretch.'),

  -- ---------- Home conditioning + core (bodyweight, zero equipment) ----------
  ('Mountain climber', 'conditioning', array['conditioning', 'core_stability'], array['Bodyweight only'],
   array['general_fitness', 'functional_fitness', 'hybrid_athlete'], 'beginner',
   array['core'], array['quads', 'shoulders'], true, false, array['wrist_or_elbow'],
   'From a push-up position, drive your knees toward your chest in alternation at pace, hips level throughout.'),
  ('Jumping jack', 'conditioning', array['conditioning'], array['Bodyweight only'],
   array['general_fitness'], 'beginner',
   array['calves'], array['shoulders'], true, false, array[]::text[],
   'Jump the feet wide while raising the arms overhead, then back together. Steady rhythm, soft landings.'),
  ('High knees', 'conditioning', array['conditioning'], array['Bodyweight only'],
   array['general_fitness', 'long_distance_runner'], 'beginner',
   array['quads'], array['calves'], true, false, array[]::text[],
   'Run in place driving the knees to hip height, arms pumping, staying tall on the balls of your feet.'),
  ('Bear crawl', 'conditioning / core', array['conditioning', 'core_stability'], array['Bodyweight only'],
   array['functional_fitness', 'general_fitness'], 'intermediate',
   array['core'], array['shoulders', 'quads'], true, false, array['wrist_or_elbow'],
   'On hands and feet with knees hovering an inch off the floor, crawl forward moving opposite hand and foot together, hips low and level.'),
  ('Hollow body hold', 'core stability', array['core_stability'], array['Bodyweight only'],
   array['functional_fitness', 'olympic_weightlifter', 'hybrid_athlete'], 'intermediate',
   array['core'], array[]::text[], false, false, array['lower_back', 'pregnancy_or_postpartum'],
   'Lying on your back, press the lower back into the floor and hold legs and shoulders off the ground in a shallow dish shape.'),
  ('Bird dog', 'core stability', array['core_stability'], array['Bodyweight only'],
   array['general_fitness'], 'beginner',
   array['core'], array['glutes'], false, true, array[]::text[],
   'On hands and knees, extend the opposite arm and leg until level with your torso, pause, and return without rocking the hips.')

) as v(name, movement_pattern, movement_patterns, equipment_required, archetype_tags, difficulty,
       primary_muscle_groups, secondary_muscle_groups, compound, unilateral, limitation_tags, instructions);
