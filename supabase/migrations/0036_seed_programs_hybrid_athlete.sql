-- Hybrid athlete training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of concurrent strength+endurance training
-- principles, sequenced to minimize interference between the two goals.

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Concurrent Strength & Conditioning (intermediate, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('hybrid_athlete', 'hybrid-concurrent', 'Concurrent Strength & Conditioning',
     'Alternates strength and conditioning days across the week, keeping hard efforts of each type on separate days to minimize interference.',
     'A concurrent-training template sequenced per well-documented interference-effect research (hard efforts of the same energy system kept apart).',
     'intermediate', 4, 5, array['Barbell', 'Dumbbells', 'Cardio machine', 'Full gym access'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Foundation', 'Establish both the strength and conditioning rhythm at moderate effort.', 4, 'RPE 6-7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength: Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 6, 8, 'rpe', '7', 'Primary lower-body strength work.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell deadlift'), 3, 5, 5, 'rpe', '7', 'Keep some reserve -- conditioning work resumes tomorrow.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 6, 3, '6 x 3 min hard, 2 min easy', 'Full-body conditioning that doesn''t add extra loading to legs already worked yesterday.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength: Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 6, 8, 'rpe', '7', 'Primary upper-body pressing work.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 4, 8, 10, 'rpe', '7', 'Balancing pulling volume.'),
    (v_session_id, 3, (select id from exercises where name = 'Pull-up'), 3, 6, 10, 'rpe', '7', 'Additional back/grip work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Genuinely easy -- this is active recovery between hard days.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Full-Body Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 4, 15, 15, 'rpe', '7', 'Hip-hinge conditioning work.'),
    (v_session_id, 2, (select id from exercises where name = 'Burpee'), 4, 10, 12, 'rpe', '7', 'Full-body finisher for the week.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Load Progression', 'Add strength load and conditioning intensity together.', 5, 'RPE 7-8', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength: Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 5, 6, 'rpe', '8', 'Heavier than foundation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell deadlift'), 3, 3, 5, 'rpe', '8', 'Heavier, still leaving reserve for conditioning.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 8, 3, '8 x 3 min hard, 2 min easy', 'Added two more rounds from the foundation phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength: Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 5, 6, 'rpe', '8', 'Heavier than foundation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 4, 6, 8, 'rpe', '8', 'Heavier than foundation phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Chest-to-bar pull-up'), 3, 5, 8, 'rpe', '8', 'A harder pulling variation than the standard pull-up.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 35, 'conversational pace', 'Kept easy regardless of the harder strength/conditioning days.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Full-Body Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 5, 15, 15, 'rpe', '8', 'Added a round from foundation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Sled push'), 4, 20, 20, 'rpe', '8', 'New this phase -- distance-based (e.g. 20m) loaded carries of intensity.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak Week', 'Highest effort of the program on both strength and conditioning before rotating.', 3, 'RPE 8-9', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength: Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 3, 5, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell deadlift'), 3, 2, 4, 'rpe', '9', 'Peak-phase intensity.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Assault bike sprints'), 10, 1, '10 x 1 min all-out, 1 min easy', 'Final, hardest conditioning session before the next program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength: Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 3, 5, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 4, 5, 6, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 3, (select id from exercises where name = 'Chest-to-bar pull-up'), 3, 5, 8, 'rpe', '9', 'Push the last set close to failure.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Still genuinely easy even in the peak week -- recovery matters more, not less.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Full-Body Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell clean and press'), 5, 8, 10, 'rpe', '9', 'Final, hardest full-body finisher of the program.'),
    (v_session_id, 2, (select id from exercises where name = 'Sled push'), 5, 20, 20, 'rpe', '9', 'Peak-phase loading.');


  -- =========================================================
  -- Program 2: Hybrid Block Periodization (intermediate/advanced, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('hybrid_athlete', 'hybrid-block-periodization', 'Hybrid Block Periodization',
     'Alternates a strength-emphasis block with an endurance-emphasis block, rather than blending both every single week.',
     'A block-periodization approach to concurrent training, prioritizing one quality at a time to reduce interference.',
     'intermediate', 4, 5, array['Barbell', 'Dumbbells', 'Cardio machine', 'Full gym access'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Strength Block', 'Prioritize strength progress; conditioning drops to maintenance volume.', 4, 'RPE 7-8 strength, easy-only conditioning', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength: Squat Focus', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 5, 6, 'rpe', '8', 'This block''s priority lift -- push it.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 8, 10, 'rpe', '7', 'Supporting posterior-chain work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Strength: Press Focus', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 5, 5, 6, 'rpe', '8', 'This block''s priority upper lift.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 4, 8, 10, 'rpe', '7', 'Balancing pull volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Maintenance Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Enough to hold aerobic fitness without eating into strength recovery.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength: Deadlift Focus', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 4, 3, 5, 'rpe', '8', 'This block''s priority pull.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Maintenance Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 25, 'moderate, steady effort', 'Second easy conditioning session, a different modality to spread impact.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Endurance Block', 'Prioritize conditioning progress; strength drops to maintenance volume.', 5, 'RPE 7-8 conditioning, maintenance-only strength', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Maintenance Strength: Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 5, 6, 'rpe', '7', 'Reduced volume from the strength block -- just enough to maintain.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning: Intervals', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 6, 4, '6 x 4 min hard, 2 min easy', 'This block''s priority session -- push the pace here.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Maintenance Strength: Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 3, 5, 6, 'rpe', '7', 'Reduced volume -- maintenance only this block.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 3, 6, 10, 'rpe', '7', 'Maintenance back volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Conditioning: Long Effort', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 60, 'easy, sustainable pace', 'This block''s long endurance session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Conditioning: Rowing Intervals', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 8, 3, '8 x 3 min hard, 2 min easy', 'Second hard conditioning session of the block.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Integration Week', 'Bring both qualities back together at a shared, testable effort.', 2, 'RPE 8-9 across both strength and conditioning', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength Test: Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 3, 5, 'rpe', '9', 'A real strength test after the endurance block''s reduced strength volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning Test', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 1, 20, 'time-trial effort', 'A real conditioning test -- see what the endurance block actually produced.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Test: Press', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 3, 3, 5, 'rpe', '9', 'Second strength test of the integration week.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Full-Body Finisher', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 4, 15, 15, 'rpe', '8', 'A blended finisher closing out the program before rotation.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Easy close to the program.');


  -- =========================================================
  -- Program 3: Daily Undulating Hybrid (advanced, 6x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('hybrid_athlete', 'hybrid-daily-undulating', 'Daily Undulating Hybrid',
     'Rotates heavy strength, light strength, and conditioning-priority days across the week rather than blocking them separately -- higher frequency, more variety.',
     'A daily undulating periodization (DUP) approach applied to concurrent strength and conditioning training.',
     'advanced', 5, 6, array['Barbell', 'Dumbbells', 'Cardio machine', 'Full gym access'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Introduction', 'Learn the undulating rhythm at moderate effort across all session types.', 3, 'RPE 6-7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Heavy Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 4, 6, 'rpe', '7', 'Heavy day of the rotation.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 4, 4, 6, 'rpe', '7', 'Heavy day of the rotation.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 6, 3, '6 x 3 min hard, 2 min easy', 'Conditioning-priority day -- legs get a break from heavy loading.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Light Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell row'), 3, 10, 12, 'rpe', '6', 'Light day -- higher reps, lower loads.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 10, 12, 'rpe', '6', 'Light day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'True recovery day within the rotation.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Heavy Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 3, 3, 5, 'rpe', '7', 'Second heavy day of the week.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 4, 15, 15, 'rpe', '7', 'Second conditioning-priority day, full-body focus.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Intensification', 'Heavier heavy days and harder conditioning days.', 5, 'RPE 8', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Heavy Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 3, 5, 'rpe', '8', 'Heavier than the introduction phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 4, 3, 5, 'rpe', '8', 'Heavier than the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 8, 3, '8 x 3 min hard, 2 min easy', 'Two more rounds than the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Light Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell row'), 3, 8, 10, 'rpe', '7', 'Slightly heavier than the introduction phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 8, 10, 'rpe', '7', 'Slightly heavier than the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 35, 'conversational pace', 'Kept easy even as other days intensify.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Heavy Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 3, 2, 4, 'rpe', '8', 'Heavier than the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell clean and press'), 5, 8, 10, 'rpe', '8', 'Harder full-body conditioning than the introduction phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak Rotation', 'The hardest version of every day type before the program rotates.', 3, 'RPE 9', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Heavy Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 2, 4, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 4, 2, 4, 'rpe', '9', 'Peak-phase intensity.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Assault bike sprints'), 10, 1, '10 x 1 min all-out, 1 min easy', 'Hardest conditioning session of the program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Light Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell row'), 3, 8, 10, 'rpe', '8', 'Even the light day is harder in the peak phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 8, 10, 'rpe', '8', 'Even the light day is harder in the peak phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Easy Aerobic', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Still genuinely easy -- recovery matters most in the peak phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Heavy Strength', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 3, 1, 3, 'rpe', '9', 'Final heavy pulling session before the program rotates.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell clean and press'), 5, 8, 10, 'rpe', '9', 'Final full-body finisher before the program rotates.');

end $$;
