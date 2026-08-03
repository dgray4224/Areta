-- Exercise library expansion for the 4 new archetypes added in 0030
-- (triathlete, cyclist, olympic_weightlifter, functional_fitness), plus
-- tagging existing endurance exercises onto triathlete/cyclist where the
-- movement is directly shared (no need to re-author running/rowing work).

update public.exercises
  set archetype_tags = archetype_tags || array['triathlete']
  where name in ('Easy-pace run', 'Treadmill intervals', 'Stationary bike steady-state', 'Rowing intervals');

update public.exercises
  set archetype_tags = archetype_tags || array['cyclist']
  where name = 'Stationary bike steady-state';

insert into public.exercises
  (name, movement_pattern, equipment_required, archetype_tags, difficulty, primary_muscle_groups, instructions) values

-- Olympic weightlifting
('Snatch', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['full body'],
 'Pull the bar from the floor to overhead in one continuous motion, receiving it in a full squat with locked-out arms.'),

('Clean and jerk', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['full body'],
 'Pull the bar to the shoulders in a front-rack squat (the clean), stand, then drive it overhead with a leg-drive dip and lockout (the jerk).'),

('Power clean', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter', 'functional_fitness'], 'intermediate',
 array['full body'],
 'Pull the bar from the floor to the shoulders, receiving it in a partial (above-parallel) squat rather than full depth.'),

('Power snatch', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter', 'functional_fitness'], 'advanced',
 array['full body'],
 'Pull the bar from the floor to overhead in one motion, receiving it in a partial squat rather than full depth.'),

('Front squat', 'squat', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter', 'powerlifter', 'hypertrophy'], 'intermediate',
 array['quads', 'core'],
 'Bar racked across the front of the shoulders, squat to depth keeping the torso upright, drive back to standing.'),

('Overhead squat', 'squat', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter', 'functional_fitness'], 'advanced',
 array['full body'],
 'Bar locked out overhead, squat to full depth while keeping the bar stacked over the mid-foot throughout.'),

('Push press', 'vertical push', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter', 'functional_fitness'], 'intermediate',
 array['shoulders', 'triceps'],
 'Dip slightly at the knees, then drive the bar overhead using leg drive plus a press to lockout.'),

('Clean pull', 'hip hinge / pull', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['back', 'hamstrings', 'glutes'],
 'Perform the pulling portion of the clean — floor to full extension with a high, aggressive shrug — without receiving the bar.'),

('Snatch pull', 'hip hinge / pull', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['back', 'hamstrings', 'glutes'],
 'Perform the pulling portion of the snatch — floor to full extension with a wide grip — without receiving the bar.'),

('Hang clean', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter', 'functional_fitness'], 'intermediate',
 array['full body'],
 'Start with the bar at the hip or knee, perform the clean from that hang position rather than the floor.'),

('Hang snatch', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['full body'],
 'Start with the bar at the hip or knee, perform the snatch from that hang position rather than the floor.'),

('Snatch balance', 'olympic lift', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['full body'],
 'Dip and drive the bar off the back of the shoulders into an overhead squat receiving position — a speed-under-the-bar drill.'),

('Split jerk', 'vertical push', array['Barbell', 'Full gym access'],
 array['olympic_weightlifter'], 'advanced',
 array['shoulders', 'triceps', 'quads'],
 'Dip and drive the bar overhead while splitting the feet front-to-back to receive it locked out.'),

-- Cyclist
('Cycling threshold intervals', 'aerobic / conditioning', array['Cardio machine', 'Full gym access'],
 array['cyclist', 'triathlete'], 'intermediate',
 array['legs', 'cardio'],
 'Sustained hard-effort intervals (e.g. 3-5 x 8 minutes) at or near threshold power, with easy spinning recovery between.'),

('Cycling hill repeats', 'aerobic / conditioning', array['Cardio machine', 'Full gym access'],
 array['cyclist', 'triathlete'], 'intermediate',
 array['legs', 'cardio'],
 'Repeated hard-effort climbs (real or simulated via resistance), seated or standing, with a recovery spin back down between reps.'),

('Standing bike sprints', 'anaerobic / speed', array['Cardio machine', 'Full gym access'],
 array['cyclist'], 'advanced',
 array['legs', 'cardio'],
 'Short (10-30 second) maximal-effort standing sprints, with full recovery between each.'),

('Single-leg pedal drills', 'aerobic', array['Cardio machine', 'Full gym access'],
 array['cyclist'], 'intermediate',
 array['legs'],
 'Pedal with one leg at a time at an easy cadence to reinforce a smooth, even pedal stroke.'),

('Bulgarian split squat', 'single-leg', array['Dumbbells', 'Full gym access'],
 array['cyclist', 'hypertrophy', 'general_fitness'], 'intermediate',
 array['quads', 'glutes'],
 'Rear foot elevated on a bench, lower the front knee toward the floor, drive back up through the front foot.'),

('Leg extension', 'knee extension', array['Full gym access'],
 array['cyclist', 'hypertrophy'], 'beginner',
 array['quads'],
 'Seated on the machine, extend the knees to lift the pad, lower under control.'),

-- Functional fitness
('Box jump', 'lower-body power', array['Bodyweight only'],
 array['functional_fitness'], 'intermediate',
 array['quads', 'glutes'],
 'Swing the arms and jump both feet onto an elevated box, standing fully upright at the top.'),

('Wall ball shot', 'squat / throw', array['Full gym access'],
 array['functional_fitness'], 'intermediate',
 array['quads', 'glutes', 'shoulders'],
 'Squat holding a medicine ball at the chest, stand and throw the ball to a target on the wall, catch and repeat.'),

('Double-unders', 'jump rope', array['Bodyweight only'],
 array['functional_fitness'], 'intermediate',
 array['legs', 'cardio'],
 'Jump rope with the rope passing under the feet twice per jump.'),

('Thruster', 'squat / push', array['Barbell', 'Dumbbells', 'Full gym access'],
 array['functional_fitness'], 'intermediate',
 array['quads', 'shoulders'],
 'Front squat to full depth, then drive up and press the load overhead in one continuous motion.'),

('Toes-to-bar', 'core', array['Pull-up bar'],
 array['functional_fitness'], 'advanced',
 array['core'],
 'Hang from the bar and raise the feet to touch the bar, keeping control on the way down.'),

('Chest-to-bar pull-up', 'vertical pull', array['Pull-up bar'],
 array['functional_fitness', 'hybrid_athlete'], 'advanced',
 array['back', 'biceps'],
 'Pull up until the chest makes contact with the bar, lower under control.'),

('Ring dip', 'horizontal/vertical push', array['Full gym access'],
 array['functional_fitness'], 'advanced',
 array['chest', 'triceps', 'shoulders'],
 'Support on gymnastics rings, lower under control until the shoulders dip below the elbows, press back up.'),

('Handstand push-up', 'vertical push', array['Bodyweight only'],
 array['functional_fitness'], 'advanced',
 array['shoulders', 'triceps'],
 'Kick up into a handstand against a wall, lower the head toward the floor, press back up to full lockout.'),

('Muscle-up', 'vertical pull / push', array['Pull-up bar', 'Full gym access'],
 array['functional_fitness'], 'advanced',
 array['back', 'chest', 'triceps'],
 'Pull up aggressively enough to transition over the bar or rings into a supported dip position, then press out.'),

('Rope climb', 'vertical pull', array['Full gym access'],
 array['functional_fitness'], 'advanced',
 array['back', 'biceps', 'core'],
 'Climb a suspended rope hand-over-hand using the legs to assist, descend under control.'),

('Sled push', 'lower-body power', array['Full gym access'],
 array['functional_fitness', 'hybrid_athlete'], 'intermediate',
 array['quads', 'glutes'],
 'Load a sled and drive it forward with low, powerful steps, staying low through the torso.'),

('Farmer''s carry', 'loaded carry', array['Dumbbells', 'Kettlebells', 'Full gym access'],
 array['functional_fitness', 'general_fitness', 'hybrid_athlete'], 'beginner',
 array['grip', 'core', 'full body'],
 'Carry a heavy load in each hand for distance or time, keeping the torso tall and braced.'),

('Devil press', 'full body / conditioning', array['Dumbbells'],
 array['functional_fitness'], 'advanced',
 array['full body'],
 'From a burpee position with hands on dumbbells, jump feet in, then clean and snatch both dumbbells overhead in one motion.'),

('Assault bike sprints', 'anaerobic / conditioning', array['Cardio machine', 'Full gym access'],
 array['functional_fitness', 'hybrid_athlete'], 'intermediate',
 array['full body', 'cardio'],
 'Short maximal-effort intervals on an air/fan bike, with a slow-pedal recovery between.'),

-- Triathlete (swim-specific; running/cycling reused via the tag updates above)
('Freestyle technique drill', 'swim', array['Full gym access'],
 array['triathlete'], 'beginner',
 array['shoulders', 'core', 'cardio'],
 'Short, form-focused swim drills (e.g. catch-up drill, single-arm freestyle) to reinforce an efficient stroke.'),

('Swim intervals', 'swim', array['Full gym access'],
 array['triathlete'], 'intermediate',
 array['shoulders', 'core', 'cardio'],
 'Repeated hard-effort pool lengths (e.g. 10 x 100m) with a short rest between, at faster than race pace.'),

('Steady-state swim', 'swim', array['Full gym access'],
 array['triathlete'], 'beginner',
 array['shoulders', 'core', 'cardio'],
 'Continuous, moderate-effort swimming to build aerobic endurance in the water.'),

('Brick run', 'aerobic', array['Bodyweight only', 'Cardio machine'],
 array['triathlete'], 'intermediate',
 array['legs', 'cardio'],
 'A short run performed immediately off the bike, training the legs to transition between disciplines.'),

('Long endurance ride', 'aerobic', array['Cardio machine', 'Full gym access'],
 array['triathlete', 'cyclist'], 'beginner',
 array['legs', 'cardio'],
 'A long, steady-effort ride well below threshold, building the aerobic base for race distance.'),

('Tempo run', 'aerobic / conditioning', array['Bodyweight only', 'Cardio machine'],
 array['triathlete', 'long_distance_runner', 'hybrid_athlete'], 'intermediate',
 array['legs', 'cardio'],
 'A sustained comfortably-hard effort run, faster than easy pace but well short of an all-out effort.');
