-- Cyclist training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of well-documented cycling training principles
-- (aerobic base, threshold/climbing development, race-specific peaking).

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Aerobic Base Building (beginner, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('cyclist', 'cyclist-aerobic-base', 'Aerobic Base Building',
     'Mostly easy-effort riding with supporting strength work, building the aerobic engine every other cycling goal is built on.',
     'A classic low-intensity aerobic-base-first approach to cycling training.',
     'beginner', 3, 4, array['Cardio machine', 'Full gym access'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Getting Started', 'Build a consistent riding habit at easy, conversational effort.', 4, 'Easy pace only', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, conversational effort', 'Should feel sustainable, not challenging.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, conversational effort', 'Second easy ride of the week.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 10, 12, 'rpe', '6', 'Per leg -- addresses side-to-side imbalances that pedaling alone doesn''t fix.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6', 'General knee/quad strength.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 60, 'easy, steady effort', 'The week''s key session -- keep the effort conservative even as distance grows.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Volume Growth', 'Extend the long ride and add modest weekly volume, still fully easy.', 6, 'Easy pace, gradual volume increase', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Slightly longer than getting-started phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Second easy ride, same duration as ride one.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 10, 12, 'rpe', '6-7', 'Maintain alongside the volume increase.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6-7', 'Maintain alongside the volume increase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 90, 'easy, steady effort', 'Add gradually -- big weekly jumps invite overuse issues.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Consolidation', 'Hold the new volume steady, confirming the base is durable.', 3, 'Easy pace, steady volume', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Same as volume-growth -- consolidating, not adding more.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Same as volume-growth.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 10, 12, 'rpe', '6-7', 'Hold steady into the next program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 90, 'easy, steady effort', 'Hold at 90 minutes -- the next program''s intensity phases build from this base.');


  -- =========================================================
  -- Program 2: Threshold & Climbing Development (intermediate, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('cyclist', 'cyclist-threshold-climbing', 'Threshold & Climbing Development',
     'Adds structured threshold intervals and hill-repeat sessions on top of an aerobic base, raising sustainable power and climbing ability.',
     'A threshold-and-climbing-focused build in the spirit of structured power-based cycling training.',
     'intermediate', 4, 5, array['Cardio machine', 'Full gym access'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Threshold Introduction', 'Introduce a weekly threshold session without disrupting the easy-ride base.', 4, 'Mostly easy, one threshold session/week', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Threshold Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 40, '3 x 8 min at threshold, easy spin recovery', 'Threshold effort feels "comfortably hard" -- sustainable for about an hour continuously.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 8, 10, 'rpe', '7', 'Supports the added riding intensity.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Hill Repeats', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling hill repeats'), 1, 35, '5 x 4 min hard climbing effort, easy spin down recovery', 'Focus on a steady cadence rather than mashing the pedals.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 90, 'easy, steady effort', 'Kept fully easy -- the week''s hard efforts happen elsewhere.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Threshold & Climb Build', 'Extend threshold interval duration and hill-repeat volume.', 5, 'Two hard sessions/week', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Threshold Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 50, '4 x 10 min at threshold, easy spin recovery', 'Extended from the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 8, 10, 'rpe', '8', 'Heavier than the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Hill Repeats', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling hill repeats'), 1, 45, '6 x 5 min hard climbing effort, easy spin down recovery', 'Added volume from the introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 105, 'easy, with a few short climbing efforts', 'Slightly longer than the introduction phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Threshold Peak', 'Highest threshold/climbing volume of the program, then a short taper.', 3, 'RPE 8 hard sessions, taper final week', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, conversational effort', 'Slightly reduced as the program tapers.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Threshold Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 55, '5 x 10 min at threshold, easy spin recovery', 'Highest threshold volume of the program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 2, 8, 10, 'rpe', '6', 'Reduced volume -- prioritize recovery for the hard riding.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Hill Repeats', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling hill repeats'), 1, 50, '7 x 5 min hard climbing effort, easy spin down recovery', 'Peak-phase climbing volume, last hard session before the taper.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 75, 'easy, steady effort', 'Shortened as part of the taper.');


  -- =========================================================
  -- Program 3: Criterium Race Peaking (advanced, 6x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('cyclist', 'cyclist-criterium-peaking', 'Criterium Race Peaking',
     'Adds repeated sprint efforts and high-intensity surges on top of a strong base, preparing for the stop-start intensity of criterium-style racing.',
     'A race-specific peaking block emphasizing repeated sprint/surge efforts for short-course criterium racing.',
     'advanced', 5, 6, array['Cardio machine', 'Full gym access'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Sprint Introduction', 'Introduce short, maximal sprint efforts after a base-building block.', 3, 'Short all-out sprints, full recovery', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Sprint Session', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Standing bike sprints'), 6, 1, '6 x 15-20 sec all-out, full recovery between', 'Full recovery matters more than rushing the next sprint -- quality over quantity.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Threshold Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 40, '4 x 8 min at threshold', 'Maintains threshold fitness alongside the new sprint work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 6, 8, 'rpe', '7', 'Heavier, lower-rep work to support sprint power.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Hill Repeats', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling hill repeats'), 1, 35, '5 x 4 min hard', 'Maintains climbing fitness.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 90, 'easy, with several short surges', 'Practice surging out of the saddle to simulate race attacks.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Repeated Surge Development', 'Build the ability to repeat hard efforts with incomplete recovery -- the defining demand of criterium racing.', 4, 'Repeated surges, short recovery', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 40, 'easy, conversational effort', 'Recovery day.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Repeated Surges', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Standing bike sprints'), 10, 1, '10 x 15 sec all-out, only 45 sec recovery between', 'Short recovery is the point -- this trains repeatability, not single-effort power.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Threshold Intervals', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 45, '4 x 10 min at threshold', 'Maintenance threshold work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Support', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 6, 8, 'rpe', '8', 'Heavier than sprint-introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Hill Repeats', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling hill repeats'), 1, 40, '6 x 4 min hard', 'Slightly more volume than sprint-introduction phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Long Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Long endurance ride'), 1, 100, 'easy, with race-simulated surging', 'Simulate the stop-start demands of an actual race within a long ride.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Race Sharpening', 'Short, sharp race-specific efforts and a volume taper before race day.', 2, 'Short and sharp, big volume cut', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Easy Ride', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 30, 'easy, conversational effort', 'Shortened -- volume comes down, not intensity.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Sharpening Sprints', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Standing bike sprints'), 5, 1, '5 x 15 sec all-out, full recovery', 'Keep the legs feeling fast without accumulating fatigue.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Short Threshold', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), 1, 25, '2 x 8 min at threshold', 'Reduced volume from repeated-surge-development phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Rest / Easy Spin', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 20, 'very easy spin', 'Just enough to stay loose -- not a training stimulus.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Openers', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Standing bike sprints'), 3, 1, '3 x 10 sec hard, full recovery', 'A short "opener" the day before racing to prime the legs without fatiguing them.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Race Day', 'bike') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 15, 'easy warm-up spin', 'Represents race-day warm-up -- the race itself isn''t a prescribable template.');

end $$;
