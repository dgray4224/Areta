-- Triathlete training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of well-documented multisport training principles
-- (balanced swim/bike/run base, brick sessions, race-distance peaking).

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Sprint Triathlon Base (beginner, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('triathlete', 'triathlete-sprint-base', 'Sprint Triathlon Base',
     'Balanced, easy-effort swim/bike/run sessions building toward a sprint-distance race -- the entry point into structured triathlon training.',
     'A balanced base-building approach for a first sprint-distance triathlon.',
     'beginner', 5, 5, array['Full gym access', 'Cardio machine'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Getting Comfortable', 'Build familiarity and comfort across all three disciplines at an easy effort.', 4, 'Easy effort throughout', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 20, 'easy, form-focused', 'Prioritize stroke technique over speed at this stage.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, steady effort', 'Comfortable, conversational effort.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 20, 'conversational pace', 'Keep it easy -- run frequency matters more than pace this early.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 25, 'continuous, easy effort', 'Second swim of the week -- continuous rather than drill-focused.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, steady effort', 'The week''s longer ride.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Volume & First Bricks', 'Extend session length and introduce brick (bike-to-run) sessions.', 5, 'Easy effort, one brick/week', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 30, 'continuous, easy effort', 'Slightly longer than the getting-comfortable phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike + Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 35, 'easy, steady effort', 'Go directly into the brick run with minimal transition time.'),
    (v_session_id, 2, (select id from exercises where name = 'Brick run'), 1, 10, 'easy, legs will feel heavy at first', 'The "dead legs" feeling is normal -- this session trains around it.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'Standalone run, slightly longer than phase 1.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 20, 'easy, form-focused', 'Keep returning to technique work even as volume grows.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 50, 'easy, steady effort', 'The week''s long ride, extended from phase 1.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Race Simulation', 'Combine everything at close to race distance and effort.', 3, 'Race-effort brick, easy elsewhere', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 25, 'continuous, race-distance effort', 'Approximate the sprint-distance swim leg.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike + Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'race-pace effort', 'This is the key race-simulation session of the week.'),
    (v_session_id, 2, (select id from exercises where name = 'Brick run'), 1, 15, 'race-pace effort', 'Practice settling into run pace off the bike.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'Easy standalone run.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 20, 'easy, form-focused', 'Kept light heading toward race day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, steady effort', 'Shorter, easy ride -- volume tapers as race day approaches.');


  -- =========================================================
  -- Program 2: Olympic Distance Build (intermediate, 6x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('triathlete', 'triathlete-olympic-build', 'Olympic Distance Build',
     'Adds structured intervals within each discipline and more frequent brick sessions to prepare for an Olympic-distance race.',
     'A structured build phase adding interval work across all three disciplines for an Olympic-distance race.',
     'intermediate', 6, 6, array['Full gym access', 'Cardio machine'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Aerobic Base', 'Rebuild the aerobic base at higher weekly volume than sprint training.', 4, 'Mostly easy effort', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 35, 'continuous, easy effort', 'Longer than the sprint program''s equivalent session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 45, 'easy, steady effort', 'Midweek ride.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 35, 'conversational pace', 'Midweek run.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 25, 'easy, form-focused', 'Second swim, technique-biased.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Bike + Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 60, 'easy, steady effort', 'Weekly long ride.'),
    (v_session_id, 2, (select id from exercises where name = 'Brick run'), 1, 15, 'easy, legs will feel heavy', 'Standard weekly brick.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 30, 'conversational pace', 'Second standalone run of the week.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Intensity Build', 'Introduce structured intervals in swim, bike, and run.', 5, 'One interval session per discipline per week', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim Intervals', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Swim intervals'), 1, 30, 'e.g. 10 x 100m at faster than race pace, short rest', 'The week''s hard swim session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 40, '4 x 8 min at threshold, easy spin recovery', 'The week''s hard bike session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run Intervals', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 1, 30, '6 x 3 min hard, 2 min jog recovery', 'The week''s hard run session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 30, 'continuous, easy effort', 'Easy second swim to balance the hard interval session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Bike + Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 70, 'easy, steady effort', 'Extended from the aerobic-base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Brick run'), 1, 20, 'easy-to-moderate', 'Longer brick run than the aerobic-base phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 35, 'conversational pace', 'Easy standalone run to balance the week''s hard sessions.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Race Peak', 'Highest-quality sessions of the program, then a short taper.', 3, 'Race-pace intervals, taper final week', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim Intervals', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Swim intervals'), 1, 25, 'race-pace repeats', 'Sharpening, not overloading -- quality over volume now.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 35, '3 x 8 min at race power, easy spin recovery', 'Slightly reduced volume from the intensity-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run Intervals', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 1, 25, '5 x 3 min at race pace, 2 min jog recovery', 'Slightly reduced volume from the intensity-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 20, 'easy, form-focused', 'Kept light heading toward race day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Bike + Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'race-pace effort', 'Final race-simulation brick before the taper.'),
    (v_session_id, 2, (select id from exercises where name = 'Brick run'), 1, 15, 'race-pace effort', 'Final race-simulation run leg.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'Easy taper-week run.');


  -- =========================================================
  -- Program 3: Half-Iron Endurance Peaking (advanced, 7x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('triathlete', 'triathlete-half-iron-peaking', 'Half-Iron Endurance Peaking',
     'Long, sustained endurance sessions across all three disciplines with race-simulation bricks, preparing for a half-iron-distance race.',
     'A long-course endurance-peaking approach for half-iron-distance racing.',
     'advanced', 6, 7, array['Full gym access', 'Cardio machine'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Volume Foundation', 'Build toward the long weekly sessions that define half-iron training.', 5, 'Easy, sustained effort', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 40, 'continuous, easy effort', 'Longest standalone swim so far in this progression.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 60, 'easy, steady effort', 'Midweek ride.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 40, 'conversational pace', 'Midweek run.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 25, 'easy, form-focused', 'Technique work between the two longer swims.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 120, 'easy, steady effort', 'The week''s defining long session -- fuel and hydrate deliberately.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Brick run'), 1, 25, 'easy, legs will feel heavy', 'Directly off the long ride the day before, or same day if schedule allows.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 7, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 70, 'easy, sustainable pace', 'The week''s standalone long run.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Race-Pace Endurance', 'Introduce race-pace segments within the long sessions.', 6, 'Long sessions with race-pace segments', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Swim intervals'), 1, 40, 'race-pace repeats within a longer session', 'Blends endurance volume with race-pace practice.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 65, 'threshold intervals within a longer ride', 'Race-specific intensity within an endurance-length ride.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Tempo run'), 1, 45, 'tempo effort within a longer run', 'Race-pace practice under fatigue.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 35, 'continuous, easy effort', 'Easy recovery swim between harder sessions.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 150, 'easy, with the final 30 min at race effort', 'Longest ride of the program -- practice race nutrition here.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Brick Run', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Brick run'), 1, 35, 'race effort in the final 10 minutes', 'Practice the race-day transition feeling under real fatigue.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 7, 'Long Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 85, 'easy, sustainable pace', 'Longest standalone run of the program.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Taper & Race', 'Sharp volume reduction while keeping short race-pace touches, arriving fresh for race day.', 2, 'Short sessions, big volume cut, brief race-pace touches', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Freestyle technique drill'), 1, 20, 'easy, form-focused', 'Volume down, keep the feel of the water.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bike', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, with brief race-pace touches', 'Short and easy -- just enough to stay sharp.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Run', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 20, 'conversational pace', 'Easy shakeout.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Swim', 'swim') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 1, 20, 'easy, sustained effort', 'Light and easy heading into race week.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Short Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, steady effort', 'Big volume cut from the race-pace-endurance phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Brick Run (short)', 'brick') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Brick run'), 1, 10, 'easy, brief race-pace touch at the end', 'Short reminder session, not a training stimulus.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 7, 'Race Day', 'run') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 10, 'easy warm-up jog', 'Represents race-day warm-up -- the race itself isn''t a prescribable template.');

end $$;
