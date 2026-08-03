-- Olympic weightlifting training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of well-documented weightlifting training
-- principles (technique-first progression, classic Bulgarian-style high
-- frequency, and Western-style periodized volume/intensity waves).

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Technical Foundations (beginner, 3x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('olympic_weightlifter', 'oly-technical-foundations', 'Technical Foundations',
     'Builds the snatch and clean & jerk from their component positions and pulls before loading them heavily -- technique before intensity.',
     'A technique-first progression common to introductory Olympic weightlifting coaching.',
     'beginner', 3, 3, array['Barbell', 'Full gym access'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Positions & Pulls', 'Groove the hang positions and pulling mechanics before the full lifts.', 4, 'Light loads, technical focus', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch Technique', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch pull'), 5, 3, 3, 'percent_1rm', '60-65', 'Focus on a fast, aggressive extension -- weight is secondary to position here.'),
    (v_session_id, 2, (select id from exercises where name = 'Hang snatch'), 5, 2, 2, 'percent_1rm', '55-60', 'Start from just above the knee to simplify the pull.'),
    (v_session_id, 3, (select id from exercises where name = 'Overhead squat'), 4, 5, 5, 'rpe', '6', 'Builds the overhead stability the snatch receiving position demands.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Clean & Jerk Technique', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean pull'), 5, 3, 3, 'percent_1rm', '60-65', 'Same emphasis as the snatch pull -- fast and aggressive.'),
    (v_session_id, 2, (select id from exercises where name = 'Hang clean'), 5, 2, 2, 'percent_1rm', '55-60', 'Start from just above the knee.'),
    (v_session_id, 3, (select id from exercises where name = 'Front squat'), 4, 5, 5, 'rpe', '6', 'The clean''s receiving position -- build comfort holding the rack position under load.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Foundation', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 5, 5, 'rpe', '7', 'General squat strength underpins both competition lifts.'),
    (v_session_id, 2, (select id from exercises where name = 'Push press'), 3, 5, 5, 'rpe', '6-7', 'Builds the overhead pressing strength the jerk relies on.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Full Lift Integration', 'Combine the pulls and receiving positions into the complete snatch and clean & jerk.', 5, 'Moderate loads, technique still the priority', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 6, 2, 2, 'percent_1rm', '65-70', 'The full lift from the floor -- reset fully between reps.'),
    (v_session_id, 2, (select id from exercises where name = 'Snatch balance'), 4, 2, 2, 'rpe', '6', 'Speed-under-the-bar drill to sharpen the receiving position.'),
    (v_session_id, 3, (select id from exercises where name = 'Overhead squat'), 3, 5, 5, 'rpe', '7', 'Continued overhead stability work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Clean & Jerk', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 6, 2, 2, 'percent_1rm', '65-70', 'The full complex -- clean, stand, jerk.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 3, 4, 5, 'rpe', '7', 'Heavier than the positions-and-pulls phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Foundation', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 5, 5, 'rpe', '8', 'Heavier than the positions-and-pulls phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Push press'), 3, 5, 5, 'rpe', '7', 'Heavier than the positions-and-pulls phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'First Test', 'A light, low-pressure test of new snatch and clean & jerk numbers.', 2, 'RPE 8 on test lifts, reduced accessory volume', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch Test', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 5, 1, 1, 'rpe', '8', 'Work up to a confident, technically sound single -- not necessarily a maximal one yet.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Clean & Jerk Test', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 5, 1, 1, 'rpe', '8', 'Same approach -- a clean single, not a grind.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength Foundation', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 5, 5, 'rpe', '7', 'Reduced volume to prioritize freshness for the two test sessions.');


  -- =========================================================
  -- Program 2: Bulgarian-Style High Frequency (intermediate, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('olympic_weightlifter', 'oly-bulgarian-frequency', 'Bulgarian-Style High Frequency',
     'Snatch and clean & jerk (or a close variant) nearly every session, at high frequency but with daily-autoregulated top singles.',
     'In the spirit of the high-frequency, near-daily-max approach associated with Bulgarian-style weightlifting programming.',
     'intermediate', 5, 5, array['Barbell', 'Full gym access'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Frequency Adaptation', 'Adapt to training the classic lifts nearly every day, keeping loads conservative.', 3, 'Daily top single at RPE 7-8', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch + Front Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 6, 1, 1, 'rpe', '7', 'Daily top single, then back down for volume.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 4, 3, 3, 'rpe', '7', 'Daily squatting is a hallmark of this style -- keep it manageable early.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Clean & Jerk + Front Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 6, 1, 1, 'rpe', '7', 'Daily top single.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 4, 3, 3, 'rpe', '7', 'Second squat session of the week.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Snatch + Back Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 6, 1, 1, 'rpe', '7-8', 'Third exposure of the week.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell back squat'), 4, 3, 3, 'rpe', '7', 'Back squat rotated in for variety.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Clean & Jerk + Back Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 6, 1, 1, 'rpe', '7-8', 'Fourth session of the week.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell back squat'), 4, 3, 3, 'rpe', '7', 'Rotating squat variation.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Snatch + Clean & Jerk', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 4, 1, 1, 'rpe', '7', 'Both classic lifts today -- keep sets crisp and technically sound.'),
    (v_session_id, 2, (select id from exercises where name = 'Clean and jerk'), 4, 1, 1, 'rpe', '7', 'Closes the week -- expect to feel the accumulated frequency.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Load Progression', 'Push daily top singles higher while maintaining the same frequency.', 5, 'Daily top single at RPE 8-9', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch + Front Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 6, 1, 1, 'rpe', '8', 'Heavier top single than frequency-adaptation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 4, 3, 3, 'rpe', '8', 'Heavier working weight.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Clean & Jerk + Front Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 6, 1, 1, 'rpe', '8', 'Heavier top single.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 4, 3, 3, 'rpe', '8', 'Heavier working weight.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Snatch + Back Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 6, 1, 1, 'rpe', '8', 'Third exposure, autoregulate down slightly if the first two felt heavy.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell back squat'), 4, 3, 3, 'rpe', '8', 'Heavier working weight.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Clean & Jerk + Back Squat', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 6, 1, 1, 'rpe', '8', 'Fourth session -- listen to daily readiness.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell back squat'), 4, 3, 3, 'rpe', '8', 'Heavier working weight.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Snatch + Clean & Jerk', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 4, 1, 1, 'rpe', '8', 'A lighter fifth-day snatch is normal given accumulated fatigue.'),
    (v_session_id, 2, (select id from exercises where name = 'Clean and jerk'), 4, 1, 1, 'rpe', '8', 'Closes the week.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak Test Week', 'A genuine max-effort test of both classic lifts, then a light week to close.', 2, 'RPE 9-10 on test day, light the rest of the week', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch Test', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 5, 1, 1, 'rpe', '9-10', 'Work up to a true max single -- this closes out the program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Light Front Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Front squat'), 3, 5, 5, 'rpe', '6', 'Light -- recovery from the snatch test.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Clean & Jerk Test', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 5, 1, 1, 'rpe', '9-10', 'Work up to a true max single.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Light Recovery', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 2, 5, 5, 'rpe', '6', 'Light close to the program before the next one begins.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Technique Only', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch balance'), 4, 2, 2, 'rpe', '5', 'Light technical work only -- fully recover before the next program.');


  -- =========================================================
  -- Program 3: Western Periodized Strength-Speed (advanced, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('olympic_weightlifter', 'oly-western-periodized', 'Western Periodized Strength-Speed',
     'A lower-frequency, higher-volume-per-session approach that waves through volume and intensity blocks toward a competition-style peak.',
     'A Western-style periodized approach to weightlifting programming, waving volume down and intensity up toward a peak.',
     'advanced', 4, 5, array['Barbell', 'Full gym access'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Volume Block', 'Higher-volume classic lift and squat work to build a foundation for the intensity to come.', 4, 'RPE 6-7, higher set counts', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch Volume', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 6, 2, 2, 'percent_1rm', '65-70', 'Higher volume than a peaking week -- focus on repeatable technique.'),
    (v_session_id, 2, (select id from exercises where name = 'Snatch pull'), 4, 3, 3, 'percent_1rm', '80', 'Overload the pull beyond what the classic lift itself uses.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Squat Volume', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Front squat'), 5, 5, 5, 'rpe', '7', 'High-volume squatting underpins both classic lifts.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell back squat'), 4, 5, 5, 'rpe', '7', 'Second squat variant of the session.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Clean & Jerk Volume', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 6, 2, 2, 'percent_1rm', '65-70', 'Same volume approach as the snatch session.'),
    (v_session_id, 2, (select id from exercises where name = 'Clean pull'), 4, 3, 3, 'percent_1rm', '80', 'Overload pull.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Pressing Volume', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Push press'), 5, 5, 5, 'rpe', '7', 'Builds jerk-supporting overhead strength.'),
    (v_session_id, 2, (select id from exercises where name = 'Split jerk'), 4, 3, 3, 'rpe', '7', 'Jerk practice without a preceding clean, isolating the footwork and drive.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Intensity Block', 'Volume comes down, loads on the classic lifts and squats go up.', 4, 'RPE 8, reduced set counts', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch Intensity', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 5, 1, 2, 'percent_1rm', '80-85', 'Heavier, lower volume than the volume block.'),
    (v_session_id, 2, (select id from exercises where name = 'Power snatch'), 3, 2, 2, 'rpe', '8', 'A faster, less-deep variation to sharpen speed at higher loads.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Squat Intensity', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Front squat'), 4, 3, 3, 'rpe', '8', 'Heavier, lower volume than the volume block.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Clean & Jerk Intensity', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 5, 1, 2, 'percent_1rm', '80-85', 'Heavier, lower volume.'),
    (v_session_id, 2, (select id from exercises where name = 'Power clean'), 3, 2, 2, 'rpe', '8', 'Faster variation at higher load.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Pressing Intensity', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Push press'), 4, 3, 3, 'rpe', '8', 'Heavier than the volume block.'),
    (v_session_id, 2, (select id from exercises where name = 'Split jerk'), 3, 2, 2, 'rpe', '8', 'Heavier than the volume block.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Competition Peak', 'Sharply reduced volume with near-maximal singles, culminating in a test day.', 2, 'RPE 9-10, singles only', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Snatch Peak', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 5, 1, 1, 'rpe', '9', 'Singles only -- this is about sharpness, not volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Light Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Front squat'), 3, 2, 3, 'rpe', '7', 'Reduced volume -- prioritize freshness for the classic lifts.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Clean & Jerk Peak', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Clean and jerk'), 5, 1, 1, 'rpe', '9', 'Singles only.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Total Test', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Snatch'), 3, 1, 1, 'rpe', '9-10', 'Test snatch, then clean & jerk in the same session -- simulates a competition total.'),
    (v_session_id, 2, (select id from exercises where name = 'Clean and jerk'), 3, 1, 1, 'rpe', '9-10', 'Test clean & jerk to close out the program.');

end $$;
