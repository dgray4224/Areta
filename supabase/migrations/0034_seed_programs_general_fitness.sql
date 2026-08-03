-- General fitness training programs: 3 methodologies, 3 phases each.
-- Emphasis on sustainable, balanced strength + cardio for general health
-- rather than sport-specific peaking.

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Full-Body Foundations (beginner, 3x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('general_fitness', 'general-fitness-full-body', 'Full-Body Foundations',
     'Three simple full-body sessions a week covering every major movement pattern -- a sustainable base for general health.',
     'A widely-taught beginner full-body strength template.',
     'beginner', 3, 3, array['Bodyweight only', 'Dumbbells'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Getting Started', 'Learn the movements at an easy, sustainable effort.', 4, 'RPE 5-6', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Full Body A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 3, 10, 12, 'rpe', '5-6', 'Focus on smooth, controlled reps.'),
    (v_session_id, 2, (select id from exercises where name = 'Push-up'), 3, 8, 10, 'rpe', '5-6', 'Drop to knees if needed to complete the set with good form.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 20-30 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Full Body B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 8, 10, 'rpe', '5-6', 'Per leg -- step deliberately, don''t rush.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '5-6', 'Hinge at the hips, keep the back flat.'),
    (v_session_id, 3, (select id from exercises where name = 'Easy-pace run'), 1, 0, 0, 'none', null, '15-20 minutes at a conversational pace.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Full Body C', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 10, 12, 'rpe', '5-6', 'Use a light dumbbell or kettlebell.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '5-6', 'Keep the ribs down to protect the low back.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 20-30 seconds per set.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Building Consistency', 'Small load and rep increases now that the movements feel familiar.', 5, 'RPE 6-7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Full Body A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 10, 12, 'rpe', '6-7', 'Progressed from bodyweight -- add light load.'),
    (v_session_id, 2, (select id from exercises where name = 'Push-up'), 3, 10, 12, 'rpe', '6-7', 'Aim for full range of motion on every rep.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 30-45 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Full Body B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 12, 'rpe', '6-7', 'Add a light dumbbell in each hand if bodyweight feels easy.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '6-7', 'Slightly heavier than the first phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Easy-pace run'), 1, 0, 0, 'none', null, '20-25 minutes at a conversational pace.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Full Body C', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 10, 12, 'rpe', '6-7', 'Second squat session -- keep an eye on recovery between the two.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '6-7', 'Slightly heavier than the first phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Kettlebell swing'), 3, 12, 15, 'rpe', '6', 'Snap the hips, don''t squat the swing.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Confidence Check', 'A slightly harder final block to confirm real progress before rotating programs.', 3, 'RPE 7', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Full Body A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 8, 10, 'rpe', '7', 'Heavier, slightly lower reps than building-consistency phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Push-up'), 3, 10, 12, 'rpe', '7', 'Elevate feet for extra challenge if these feel easy.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45-60 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Full Body B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 12, 'rpe', '7', 'Final progression before the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 8, 10, 'rpe', '7', 'Heavier working weight.'),
    (v_session_id, 3, (select id from exercises where name = 'Easy-pace run'), 1, 0, 0, 'none', null, '25-30 minutes at a conversational pace.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Full Body C', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 8, 10, 'rpe', '7', 'Heavier than building-consistency phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '7', 'Final progression before the next program.'),
    (v_session_id, 3, (select id from exercises where name = 'Kettlebell swing'), 3, 15, 15, 'rpe', '7', 'Higher rep target than building-consistency phase.');


  -- =========================================================
  -- Program 2: Balanced Strength & Cardio (beginner/intermediate, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('general_fitness', 'general-fitness-balanced', 'Balanced Strength & Cardio',
     'Alternates two strength sessions with two cardio sessions each week, for well-rounded health rather than a single specialty.',
     'A general balanced-fitness template combining resistance training with aerobic conditioning guidance.',
     'beginner', 3, 4, array['Dumbbells', 'Cardio machine', 'Full gym access'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Base Building', 'Establish the weekly rhythm of two strength days and two cardio days.', 4, 'RPE 5-6', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 10, 12, 'rpe', '5-6', 'Comfortable, controlled tempo.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell bench press'), 3, 10, 12, 'rpe', '5-6', 'Full range of motion.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '5-6', 'Balances the pressing work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Cardio A', 'cardio') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 20, 'conversational pace', 'Should be able to hold a conversation throughout.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 12, 'rpe', '5-6', 'Per leg.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '5-6', 'Comfortable, controlled tempo.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 30 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Cardio B', 'cardio') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 20, 'moderate, steady effort', 'A change of modality from the running day to spread the impact load.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Progression', 'Increase strength loads and cardio duration together.', 5, 'RPE 6-7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 8, 10, 'rpe', '6-7', 'Heavier load than base-building phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell bench press'), 3, 8, 10, 'rpe', '6-7', 'Heavier load than base-building phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 3, 8, 10, 'rpe', '6-7', 'Heavier load than base-building phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Cardio A', 'cardio') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 1, 25, 'conversational pace', 'Duration increased from the base-building phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 8, 10, 'rpe', '6-7', 'Add light dumbbells if not already using them.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '6-7', 'Heavier load than base-building phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Cardio B', 'cardio') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 1, 25, 'moderate, steady effort', 'Duration increased from the base-building phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Final Push', 'Slightly higher effort across both strength and cardio to close out the program.', 3, 'RPE 7', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 8, 10, 'rpe', '7', 'Final progression before the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell bench press'), 3, 8, 10, 'rpe', '7', 'Final progression before the next program.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell row'), 3, 8, 10, 'rpe', '7', 'Final progression before the next program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Cardio A', 'cardio') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 1, 20, 'alternating hard/easy', 'A change of pace from steady-state to intervals to close the program with variety.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 8, 10, 'rpe', '7', 'Final progression before the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '7', 'Final progression before the next program.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 60 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Cardio B', 'cardio') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 1, 20, 'alternating hard/easy', 'A third cardio modality across the program to keep things engaging.');


  -- =========================================================
  -- Program 3: Functional Full-Body Circuit (intermediate, 3x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('general_fitness', 'general-fitness-circuit', 'Functional Full-Body Circuit',
     'Time-efficient circuit-style sessions mixing strength and conditioning in one workout, for people who want a single efficient session rather than splitting strength and cardio days.',
     'A general circuit-training template blending resistance and conditioning work.',
     'intermediate', 2, 3, array['Bodyweight only', 'Kettlebells', 'Dumbbells'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Circuit Introduction', 'Learn the circuit format at a manageable pace.', 3, 'RPE 6, 2 rounds', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Circuit A', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 2, 12, 15, 'rpe', '6', 'Move through the circuit with minimal rest between exercises.'),
    (v_session_id, 2, (select id from exercises where name = 'Push-up'), 2, 8, 10, 'rpe', '6', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Kettlebell swing'), 2, 12, 15, 'rpe', '6', 'Rest 2 minutes after completing a full round, then repeat.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Circuit B', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 2, 10, 12, 'rpe', '6', 'Per leg, alternating.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 2, 10, 12, 'rpe', '6', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 2, 0, 0, 'none', null, 'Hold 20-30 seconds, then rest 2 minutes and repeat the round.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Circuit C', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Burpee'), 2, 8, 10, 'rpe', '6', 'Scale the tempo as needed to keep moving.'),
    (v_session_id, 2, (select id from exercises where name = 'Goblet squat'), 2, 12, 15, 'rpe', '6', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 2, 10, 12, 'rpe', '6', 'Rest 2 minutes after the round, then repeat.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Circuit Progression', 'Add a third round and tighten transition time between exercises.', 5, 'RPE 7, 3 rounds', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Circuit A', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 3, 12, 15, 'rpe', '7', 'Third round added -- pace yourself early in the circuit.'),
    (v_session_id, 2, (select id from exercises where name = 'Push-up'), 3, 8, 10, 'rpe', '7', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Kettlebell swing'), 3, 12, 15, 'rpe', '7', 'Rest 90 seconds between rounds, down from 2 minutes.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Circuit B', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 10, 12, 'rpe', '7', 'Third round added.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '7', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 30-40 seconds, rest 90 seconds between rounds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Circuit C', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Burpee'), 3, 8, 10, 'rpe', '7', 'Third round added.'),
    (v_session_id, 2, (select id from exercises where name = 'Goblet squat'), 3, 12, 15, 'rpe', '7', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '7', 'Rest 90 seconds between rounds.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Circuit Peak', 'Fastest pace and least rest of the program before rotating to something new.', 2, 'RPE 8, 3 rounds, minimal rest', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Circuit A', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bodyweight squat'), 3, 15, 15, 'rpe', '8', 'Fastest pace of the program -- rest only 60 seconds between rounds.'),
    (v_session_id, 2, (select id from exercises where name = 'Push-up'), 3, 10, 12, 'rpe', '8', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Kettlebell swing'), 3, 15, 15, 'rpe', '8', 'Final week before the next program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Circuit B', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Reverse lunge'), 3, 12, 15, 'rpe', '8', 'Rest only 60 seconds between rounds.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 12, 15, 'rpe', '8', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45 seconds, rest 60 seconds between rounds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Circuit C', 'circuit') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Burpee'), 3, 10, 12, 'rpe', '8', 'Peak-phase pace.'),
    (v_session_id, 2, (select id from exercises where name = 'Goblet squat'), 3, 15, 15, 'rpe', '8', 'Same circuit flow.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 12, 15, 'rpe', '8', 'Final week before the next program.');

end $$;
