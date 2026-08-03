-- Long-distance runner training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of well-documented distance-running training
-- principles (aerobic base building, threshold work, interval/VO2max
-- development, taper) -- generic, not any single coach's proprietary plan.

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Base Building Mileage (beginner, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('long_distance_runner', 'runner-base-building', 'Base Building Mileage',
     'Mostly easy-effort running with one weekly long run, building the aerobic base that every other kind of running is built on.',
     'A classic aerobic-base-first approach to distance running, in the spirit of high-mileage-easy-effort training philosophies (e.g. Arthur Lydiard).',
     'beginner', 3, 4, array['Bodyweight only', 'Cardio machine'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Aerobic Foundation', 'Build a consistent running habit at an easy, conversational effort.', 4, 'Easy pace only', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'You should be able to speak in full sentences the whole run.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'Second easy run of the week -- resist the urge to push the pace.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 3, 12, 15, 'rpe', '6', 'General leg strength -- keeps you resilient to the added mileage.'),
    (v_session_id, 2, (select id from exercises where name = 'Reverse lunge'), 3, 10, 10, 'rpe', '6', 'Per leg, single-leg strength and stability.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 30 seconds -- core stability supports running form as fatigue builds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 45, 'easy, sustainable pace', 'The most important run of the week -- keep the effort conservative even as the distance grows.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Volume Growth', 'Extend the long run and add modest weekly mileage, still entirely at an easy effort.', 6, 'Easy pace, weekly mileage +10% cap', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Slightly longer than the foundation phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Keep both midweek runs at the same easy effort as the long run.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 3, 12, 15, 'rpe', '6-7', 'Maintain this alongside the mileage increase.'),
    (v_session_id, 2, (select id from exercises where name = 'Reverse lunge'), 3, 10, 10, 'rpe', '6-7', 'Per leg.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 40-45 seconds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 60, 'easy, sustainable pace', 'Add roughly 10% to the long run every couple of weeks, not every week.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Consolidation', 'Hold the new volume steady rather than pushing further, confirming the base is durable.', 3, 'Easy pace, steady volume', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Same volume as volume-growth -- this block is about consolidating, not adding more.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Same as volume-growth.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 3, 12, 15, 'rpe', '6-7', 'Hold steady into the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45 seconds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 60, 'easy, sustainable pace', 'Hold at 60 minutes -- the next program''s intensity phases build from this base.');


  -- =========================================================
  -- Program 2: Threshold & Tempo Development (intermediate, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('long_distance_runner', 'runner-threshold-tempo', 'Threshold & Tempo Development',
     'Adds a weekly tempo run and threshold work on top of an aerobic base, raising the pace you can sustain for longer efforts.',
     'A threshold/tempo-focused approach in the spirit of lactate-threshold training popularized by coaches like Jack Daniels.',
     'intermediate', 4, 5, array['Bodyweight only', 'Cardio machine'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Threshold Introduction', 'Introduce a weekly tempo effort without disrupting the easy-run base.', 4, 'Mostly easy pace, one tempo effort/week', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Recovery day -- keep it genuinely easy.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Tempo Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Tempo run'), 1, 20, 'comfortably hard, ~10K effort', 'Warm up 10 minutes easy first -- this effort should feel controlled, not desperate.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Easy day between the tempo effort and the long run.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 10, 'rpe', '6-7', 'Per leg -- supports the added running intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45 seconds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 60, 'easy, sustainable pace', 'Kept fully easy -- the tempo run supplies the week''s hard effort.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Threshold Development', 'Extend tempo duration and introduce structured threshold intervals.', 5, 'One tempo + one threshold-interval session/week', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Tempo Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Tempo run'), 1, 30, 'comfortably hard, ~10K effort', 'Extended from 20 to 30 minutes.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Threshold Intervals', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 4, 6, '4 x 6 min @ threshold pace, 90s jog recovery', 'Threshold pace feels "comfortably hard" -- sustainable for about an hour if run continuously.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 10, 'rpe', '7', 'Per leg.'),
    (v_session_id, 2, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45-60 seconds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 70, 'easy, sustainable pace', 'Slightly longer than threshold-introduction phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Threshold Peak', 'Highest threshold volume of the program, then a short taper.', 3, 'RPE 8 on threshold work, taper final week', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'Slightly reduced as the program tapers.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Tempo Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Tempo run'), 1, 25, 'comfortably hard, ~10K effort', 'Slightly reduced to manage fatigue heading into the taper.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Threshold Intervals', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 5, 5, '5 x 5 min @ threshold pace, 90s jog recovery', 'Highest threshold volume of the program -- last hard interval session before the taper.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Plank'), 2, 0, 0, 'none', null, 'Reduced volume -- prioritize recovery for running.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 50, 'easy, sustainable pace', 'Shortened from threshold-development phase as part of the taper.');


  -- =========================================================
  -- Program 3: Interval & Speed Peaking (advanced, 6x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('long_distance_runner', 'runner-interval-peaking', 'Interval & Speed Peaking',
     'Layers VO2max intervals and race-pace work on top of a high aerobic base, for runners peaking toward a specific race.',
     'A VO2max-interval peaking block in the spirit of classic periodized distance-running peaking phases.',
     'advanced', 5, 6, array['Bodyweight only', 'Cardio machine'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Speed Introduction', 'Introduce short, fast intervals to sharpen turnover after a base-building block.', 3, 'Short intervals at 5K pace or faster', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Interval Session', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 6, 3, '6 x 3 min @ 5K pace, 2 min jog recovery', 'Faster than threshold pace -- these should feel hard but repeatable.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Easy day between hard sessions.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Tempo Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Tempo run'), 1, 25, 'comfortably hard, ~10K effort', 'Maintains threshold fitness alongside the new speed work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 10, 'rpe', '7', 'Per leg -- supports the higher-impact speed work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 75, 'easy, with the last 10 minutes at race pace', 'The race-pace finish teaches the legs what goal pace feels like when tired.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'VO2max Development', 'The hardest interval work of the program, building top-end aerobic power.', 4, 'Intervals at ~3K-5K pace', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Interval Session', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 5, 4, '5 x 4 min @ 3K-5K pace, 3 min jog recovery', 'The hardest interval session of the program -- prioritize hitting the pace over adding extra reps.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Easy day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Tempo Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Tempo run'), 1, 25, 'comfortably hard, ~10K effort', 'Maintenance tempo work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 2, 10, 10, 'rpe', '6', 'Reduced volume to prioritize recovery for the hard interval work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 80, 'easy, with the last 15 minutes at race pace', 'Longest run of the program.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Taper & Race', 'Sharply reduced volume with maintained intensity, arriving fresh for race day.', 2, 'Short, sharp efforts, big volume cut', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 20, 'conversational pace', 'Shortened -- volume comes down, not intensity.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Sharpening Intervals', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 4, 2, '4 x 2 min @ race pace or slightly faster, full recovery', 'Short and sharp -- keep the legs feeling fast without accumulating fatigue.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Easy Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 20, 'conversational pace', 'Easy shakeout.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Rest / Light Jog', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 15, 'very easy shakeout pace', 'Just enough to stay loose -- this is not a training stimulus day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 40, 'easy, sustainable pace', 'Well below peak-phase volume -- the goal now is freshness, not fitness gains.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Race Day', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 15, 'easy warm-up jog', 'Represents race-day warm-up -- the race itself isn''t a prescribable template.');

end $$;
