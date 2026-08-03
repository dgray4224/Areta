-- Powerlifter training programs: 3 distinct methodologies, 3 phases each.
-- Content is a best-effort synthesis of well-documented, publicly known
-- powerlifting training principles (linear progression, conjugate method,
-- RPE autoregulation) -- not a verbatim reproduction of any single coach's
-- proprietary program. methodology_note credits the general school of
-- thought for context, not a licensed source.

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Linear Progression Basics (beginner, 3x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('powerlifter', 'powerlifter-linear-progression', 'Linear Progression Basics',
     'A straightforward full-body A/B split that adds weight to the bar every session -- the classic entry point into structured strength training.',
     'In the spirit of classic novice linear-progression programming popularized by coaches like Mark Rippetoe.',
     'beginner', 3, 3, array['Barbell', 'Full gym access'], 1)
  returning id into v_program_id;

  -- Phase 1: Foundation
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Foundation', 'Groove technique on the big lifts at moderate loads before adding weight aggressively.', 3, 'RPE 6-7, technical focus', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Workout A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 5, 5, 'rpe', '6-7', 'Same working weight across all sets -- master the depth and bracing before loading up.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 3, 5, 5, 'rpe', '6-7', 'Pause briefly on the chest each rep to build a consistent bottom position.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell row'), 3, 8, 8, 'rpe', '6-7', 'Control the descent -- this is the antagonist volume to the pressing work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Workout B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 5, 5, 'rpe', '6-7', 'Same protocol as Workout A -- squatting every session is the core driver of this program.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 3, 5, 5, 'rpe', '6-7', 'Brace the core hard -- no lower-back arching to compensate.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell deadlift'), 1, 5, 5, 'rpe', '7', 'One top set is plenty this early -- deadlift recovers slower than it feels in the moment.');

  -- Phase 2: Progression
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Progression', 'Standard session-to-session load increases now that technique is grooved.', 5, 'RPE 7-8, small consistent jumps', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Workout A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 5, 5, 'rpe', '7-8', 'Add a small increment each session as long as all reps are clean.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 3, 5, 5, 'rpe', '7-8', 'Increment more conservatively than squat -- upper-body progress is slower.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell row'), 3, 8, 8, 'rpe', '7', 'Keep this a notch below the pressing intensity -- it''s supporting volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Workout B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 5, 5, 'rpe', '7-8', 'Second squat session of the week -- expect it to feel heavier than Workout A.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 3, 5, 5, 'rpe', '7-8', 'The slowest-progressing lift in the program -- stay patient with increments.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell deadlift'), 1, 5, 5, 'rpe', '8', 'Still one top set -- let squat do the volume work this phase.');

  -- Phase 3: Peak Test (final)
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak Test', 'Taper volume and establish a new set of training maxes to build the next program around.', 2, 'RPE 8-9, low volume, one test session', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Workout A - Taper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 2, 3, 3, 'rpe', '8', 'Reduce volume so you show up fresh for the test session.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 2, 3, 3, 'rpe', '8', 'Same idea -- fewer, crisper reps.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Workout B - Test', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 1, 3, 3, 'rpe', '9', 'A hard, clean triple -- this becomes the training max the next program is built from.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 1, 3, 3, 'rpe', '9', 'Same test protocol.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell deadlift'), 1, 3, 3, 'rpe', '9', 'Test last -- deadlift is the most fatiguing of the three.');


  -- =========================================================
  -- Program 2: Conjugate-Style Strength (intermediate/advanced, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('powerlifter', 'powerlifter-conjugate', 'Conjugate-Style Strength',
     'Rotating max-effort work paired with speed-focused dynamic-effort work for the squat/deadlift and bench, addressing strength and speed year-round.',
     'In the spirit of the conjugate/Westside-style method popularized by Louie Simmons.',
     'intermediate', 4, 4, array['Barbell', 'Full gym access'], 2)
  returning id into v_program_id;

  -- Phase 1: Accumulation
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Accumulation', 'Build general work capacity and bar speed before intensity climbs.', 4, 'RPE 7-8 max effort, ~60% dynamic effort', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Max Effort Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 1, 3, 'rpe', '8', 'Work up to a heavy set of 1-3 for the week, then move to accessories.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell deadlift'), 3, 5, 5, 'percent_1rm', '70-75', 'Moderate deadlift volume -- it isn''t the max-effort lift today.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '7', 'Quad accessory volume to support the squat.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Max Effort Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 5, 1, 3, 'rpe', '8', 'Weekly heavy set of 1-3, rotating grip/tempo variations over time to avoid staleness.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 3, 6, 8, 'rpe', '7', 'Shoulder-strength accessory work.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '7', 'Back volume to balance the pressing.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Dynamic Effort Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 8, 2, 2, 'percent_1rm', '55-60', 'Speed work -- move the bar as fast as possible on every rep, resting fully between sets.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 3, 5, 5, 'rpe', '7', 'Front squat builds the upright torso position that carries over to the back squat.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Dynamic Effort Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 9, 3, 3, 'percent_1rm', '55-60', 'Speed-bench triples, focusing on a fast, controlled bar path off the chest.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 3, 6, 10, 'rpe', '7', 'General back/grip work between speed sets.');

  -- Phase 2: Intensification
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Intensification', 'Heavier max-effort work and higher dynamic-effort percentages.', 5, 'RPE 8-9 max effort, ~65-70% dynamic effort', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Max Effort Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 1, 2, 'rpe', '9', 'Heavier top single/double than the accumulation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell deadlift'), 3, 3, 5, 'percent_1rm', '75-80', 'Volume climbs alongside intensity.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg press'), 3, 8, 10, 'rpe', '8', 'Slightly heavier accessory loading.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Max Effort Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 5, 1, 2, 'rpe', '9', 'Heavier weekly max-effort attempt.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 3, 5, 6, 'rpe', '8', 'Slightly heavier than accumulation.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 3, 8, 10, 'rpe', '8', 'Keep back volume up to support bench.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Dynamic Effort Lower', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 8, 2, 2, 'percent_1rm', '65-70', 'Percentage climbs from accumulation -- bar speed should still be crisp; if it slows noticeably, don''t add more.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 3, 4, 5, 'rpe', '8', 'Slightly heavier front squat work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Dynamic Effort Upper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 9, 3, 3, 'percent_1rm', '65-70', 'Speed triples at a higher percentage.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 3, 5, 8, 'rpe', '8', 'Add load if bodyweight reps exceed 10 comfortably.');

  -- Phase 3: Realization (final)
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Realization', 'Taper accessory volume and test new max-effort numbers on the competition lifts.', 3, 'RPE 9-10 on test lifts, minimal accessory volume', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Max Effort Lower - Test', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 1, 1, 'rpe', '9-10', 'Work up to a true single -- this sets the next block''s training percentages.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell deadlift'), 3, 2, 3, 'percent_1rm', '80', 'Kept moderate -- deadlift gets tested next session, not this one.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Max Effort Upper - Test', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 5, 1, 1, 'rpe', '9-10', 'Work up to a true single.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 2, 5, 5, 'rpe', '7', 'Light -- this session is about the bench test.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Dynamic Effort Lower - Taper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 5, 1, 1, 'rpe', '9-10', 'Deadlift gets its true-single test here, fresher than pairing it with squat testing.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Dynamic Effort Upper - Taper', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 6, 2, 2, 'percent_1rm', '55', 'Light speed work only -- recover into the next program.');


  -- =========================================================
  -- Program 3: RPE-Based Block Periodization (intermediate, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('powerlifter', 'powerlifter-rpe-block', 'RPE-Based Block Periodization',
     'One session per week for each competition lift plus a combined accessory day, autoregulated with RPE rather than fixed percentages.',
     'In the spirit of RPE-based autoregulation popularized by coaches like Mike Tuchscherer and Eric Helms.',
     'intermediate', 4, 4, array['Barbell', 'Full gym access'], 3)
  returning id into v_program_id;

  -- Phase 1: Volume Accumulation
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Volume Accumulation', 'Higher rep ranges at moderate RPE to accumulate volume.', 4, 'RPE 6-7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Squat Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 6, 8, 'rpe', '6-7', 'Stop each set 3-4 reps short of failure.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 3, 8, 10, 'rpe', '6', 'Lighter, quad-biased volume.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 10, 12, 'rpe', '6', 'Posterior chain accessory work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bench Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 6, 8, 'rpe', '6-7', 'Focus on bar path consistency at this volume.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '6', 'Shoulder accessory volume.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '6', 'Balancing back volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Deadlift Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 3, 5, 6, 'rpe', '6-7', 'Fewer sets than squat/bench -- deadlift volume adds up fast.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '6', 'Quad volume without the fatigue cost of more deadlifting.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Accessory Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Pull-up'), 3, 6, 10, 'rpe', '7', 'General back/grip volume.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 3, 8, 10, 'rpe', '6', 'Extra pressing volume without adding bench frequency.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 30-45 seconds per set for trunk stability.');

  -- Phase 2: Intensification
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Intensification', 'Lower reps, higher RPE, volume trimmed to manage fatigue.', 5, 'RPE 8-9', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Squat Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 3, 5, 'rpe', '8-9', 'Reps come down, weight goes up -- stay honest about the RPE.'),
    (v_session_id, 2, (select id from exercises where name = 'Front squat'), 2, 5, 6, 'rpe', '7', 'Reduced volume to manage total fatigue.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 2, 8, 10, 'rpe', '7', 'Maintenance-level posterior chain work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bench Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 3, 5, 'rpe', '8-9', 'Heavier working sets than accumulation.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 2, 6, 8, 'rpe', '7', 'Trimmed accessory volume.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 2, 8, 10, 'rpe', '7', 'Maintenance back volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Deadlift Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 3, 2, 4, 'rpe', '8-9', 'Heavier, lower-rep pulls.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg press'), 2, 8, 10, 'rpe', '7', 'Kept light to prioritize deadlift recovery.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Accessory Day', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Pull-up'), 3, 5, 8, 'rpe', '8', 'Add load if needed to stay in this rep range.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 2, 6, 8, 'rpe', '7', 'Trimmed slightly from accumulation.');

  -- Phase 3: Peak (final)
  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak', 'Minimal volume, near-maximal singles/doubles, then test.', 2, 'RPE 9-10, very low volume', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Squat Day - Peak', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 3, 1, 2, 'rpe', '9', 'Low volume, high intensity -- freshness matters more than work done here.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Bench Day - Peak', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 3, 1, 2, 'rpe', '9', 'Same low-volume, high-intensity approach.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Deadlift Day - Test', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 3, 1, 1, 'rpe', '9-10', 'Test single -- this closes out the program and sets the next block''s numbers.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Squat/Bench Test', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 1, 1, 1, 'rpe', '9-10', 'Test single.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell bench press'), 1, 1, 1, 'rpe', '9-10', 'Test single.');

end $$;
