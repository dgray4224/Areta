-- Hypertrophy training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of well-documented bodybuilding training
-- principles (upper/lower split, push/pull/legs, German volume training)
-- -- not a verbatim reproduction of any single coach's proprietary plan.

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Upper/Lower Split (beginner, 4x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('hypertrophy', 'hypertrophy-upper-lower', 'Upper/Lower Split',
     'Two upper-body and two lower-body sessions per week -- a balanced, sustainable entry point into structured muscle-building training.',
     'A classic, widely-taught upper/lower hypertrophy split structure.',
     'beginner', 4, 4, array['Dumbbells', 'Full gym access'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Foundation', 'Build a movement base at moderate volume before pushing sets closer to failure.', 4, 'RIR 3-4 (leave 3-4 reps in reserve)', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Upper A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell bench press'), 3, 10, 12, 'rpe', '6-7', 'Full range of motion, controlled descent.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '6-7', 'Squeeze the shoulder blade at the top of each rep.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '6-7', 'Keep the core braced -- no excessive low-back arch.'),
    (v_session_id, 4, (select id from exercises where name = 'Lat pulldown'), 3, 10, 12, 'rpe', '6', 'Pull to the upper chest, control the return.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Lower A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 3, 10, 12, 'rpe', '6-7', 'Sit between the knees, chest tall.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 10, 12, 'rpe', '6-7', 'Feel this in the hamstrings, not the low back.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg press'), 3, 12, 15, 'rpe', '6', 'Full range, controlled tempo.'),
    (v_session_id, 4, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 30-45 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Upper B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Pull-up'), 3, 6, 10, 'rpe', '7', 'Use an assisted variation or band if a full set of 6 clean reps isn''t there yet.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '6-7', 'Second pressing movement of the week -- keep smooth reps.'),
    (v_session_id, 3, (select id from exercises where name = 'Cable row'), 3, 10, 12, 'rpe', '6-7', 'Squeeze at the finish, avoid using momentum.'),
    (v_session_id, 4, (select id from exercises where name = 'Dumbbell bench press'), 2, 12, 15, 'rpe', '6', 'Lighter, higher-rep finisher for the chest.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Lower B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 3, 10, 12, 'rpe', '7', 'Per leg -- expect this to feel harder than it looks.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6', 'Isolated quad finisher.'),
    (v_session_id, 3, (select id from exercises where name = 'Hanging leg raise'), 3, 8, 12, 'rpe', '6-7', 'Control the swing -- quality over speed.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Volume Ramp', 'Push working sets closer to failure and add a set to key lifts.', 5, 'RIR 1-2', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Upper A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell bench press'), 4, 8, 10, 'rpe', '8', 'Added a set, tightened the rep range -- push these sets harder.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 4, 8, 10, 'rpe', '8', 'Same treatment -- one more set of work than the foundation phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '7-8', 'Heavier working weight than foundation phase.'),
    (v_session_id, 4, (select id from exercises where name = 'Lat pulldown'), 3, 10, 12, 'rpe', '7', 'Keep this a support movement, not a max effort.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Lower A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 4, 8, 10, 'rpe', '8', 'Heavier load, same tight technique.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 4, 8, 10, 'rpe', '8', 'One more working set than foundation.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg press'), 3, 10, 12, 'rpe', '7', 'Slightly heavier, slightly fewer reps.'),
    (v_session_id, 4, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 45-60 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Upper B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Pull-up'), 4, 6, 8, 'rpe', '8', 'Add weight if bodyweight reps are no longer challenging in this range.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 8, 10, 'rpe', '7-8', 'Heavier than foundation phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Cable row'), 4, 8, 10, 'rpe', '8', 'One more set than foundation phase.'),
    (v_session_id, 4, (select id from exercises where name = 'Dumbbell bench press'), 3, 10, 12, 'rpe', '7', 'Slightly heavier finisher work.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Lower B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 4, 8, 10, 'rpe', '8', 'Heavier per-leg loading.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg extension'), 4, 10, 12, 'rpe', '7-8', 'One more set than foundation.'),
    (v_session_id, 3, (select id from exercises where name = 'Hanging leg raise'), 3, 10, 15, 'rpe', '7', 'Slightly higher rep target.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak Volume', 'Highest volume and effort of the program before a deload into the next one.', 3, 'RIR 0-1 on final sets', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Upper A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell bench press'), 4, 8, 10, 'rpe', '9', 'Last set of the week for this lift -- take it right to the edge.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 4, 8, 10, 'rpe', '9', 'Same -- push the final set hard.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 4, 8, 10, 'rpe', '8-9', 'Added a set from the volume-ramp phase.'),
    (v_session_id, 4, (select id from exercises where name = 'Lat pulldown'), 3, 10, 12, 'rpe', '8', 'Keep form crisp even as fatigue builds.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Lower A', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 4, 8, 10, 'rpe', '9', 'Peak-phase intensity -- last hard week before the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 4, 8, 10, 'rpe', '9', 'Push the final set close to failure with strict form.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg press'), 4, 10, 12, 'rpe', '8', 'Added a set from volume-ramp.'),
    (v_session_id, 4, (select id from exercises where name = 'Plank'), 3, 0, 0, 'none', null, 'Hold 60 seconds per set.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Upper B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Pull-up'), 4, 6, 8, 'rpe', '9', 'Final hard back session before the next program begins.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 4, 8, 10, 'rpe', '8-9', 'Added a set from volume-ramp.'),
    (v_session_id, 3, (select id from exercises where name = 'Cable row'), 4, 8, 10, 'rpe', '9', 'Push the last set close to failure.'),
    (v_session_id, 4, (select id from exercises where name = 'Dumbbell bench press'), 3, 10, 12, 'rpe', '8', 'Finisher volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Lower B', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Bulgarian split squat'), 4, 8, 10, 'rpe', '9', 'Peak-phase per-leg loading.'),
    (v_session_id, 2, (select id from exercises where name = 'Leg extension'), 4, 10, 12, 'rpe', '8-9', 'Push the last set close to failure.'),
    (v_session_id, 3, (select id from exercises where name = 'Hanging leg raise'), 4, 10, 15, 'rpe', '8', 'Added a set from volume-ramp.');


  -- =========================================================
  -- Program 2: Push/Pull/Legs (intermediate, 6x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('hypertrophy', 'hypertrophy-push-pull-legs', 'Push/Pull/Legs',
     'A high-frequency split that hits every muscle group twice per week by rotating push, pull, and leg days.',
     'A classic, widely-taught push/pull/legs (PPL) bodybuilding split.',
     'intermediate', 5, 6, array['Barbell', 'Dumbbells', 'Full gym access'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Base Hypertrophy', 'Establish working weights across the full PPL rotation.', 4, 'RIR 2-3', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Push', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 8, 10, 'rpe', '7', 'Primary chest/press movement of the day.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 3, 8, 10, 'rpe', '7', 'Shoulder pressing volume.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '6-7', 'Secondary shoulder work at a lighter load.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Pull', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell row'), 4, 8, 10, 'rpe', '7', 'Primary back-thickness movement.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 3, 6, 10, 'rpe', '7', 'Back-width work.'),
    (v_session_id, 3, (select id from exercises where name = 'Lat pulldown'), 3, 10, 12, 'rpe', '6-7', 'Additional lat volume if pull-ups are limited by grip/back fatigue.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Legs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 8, 10, 'rpe', '7', 'Primary quad/glute movement.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 3, 10, 12, 'rpe', '6-7', 'Hamstring/glute volume.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '6-7', 'Quad isolation finisher.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Push', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell bench press'), 4, 10, 12, 'rpe', '7', 'Second push day -- a different angle/rep range than the first.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '7', 'Primary shoulder work today.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell overhead press'), 2, 8, 10, 'rpe', '6-7', 'Lighter second exposure.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Pull', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cable row'), 4, 10, 12, 'rpe', '7', 'Second back-thickness movement of the week.'),
    (v_session_id, 2, (select id from exercises where name = 'Chin-up'), 3, 6, 10, 'rpe', '7', 'Underhand grip for a biceps-biased pulling angle.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Legs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Leg press'), 4, 10, 12, 'rpe', '7', 'Second leg day, machine-based to manage joint fatigue.'),
    (v_session_id, 2, (select id from exercises where name = 'Bulgarian split squat'), 3, 10, 12, 'rpe', '7', 'Unilateral work to address side-to-side imbalances.'),
    (v_session_id, 3, (select id from exercises where name = 'Hanging leg raise'), 3, 8, 12, 'rpe', '6-7', 'Core finisher.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Volume Ramp', 'Add a set to each primary lift and push closer to failure.', 5, 'RIR 1-2', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Push', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 5, 8, 10, 'rpe', '8', 'Added a set from base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 4, 8, 10, 'rpe', '8', 'Heavier working weight than base phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '7', 'Keep this a support lift, not a grind.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Pull', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell row'), 5, 8, 10, 'rpe', '8', 'Added a set from base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 4, 6, 10, 'rpe', '8', 'Add load if bodyweight is no longer challenging.'),
    (v_session_id, 3, (select id from exercises where name = 'Lat pulldown'), 3, 10, 12, 'rpe', '7', 'Support volume for the lats.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Legs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 8, 10, 'rpe', '8', 'Added a set from base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 4, 10, 12, 'rpe', '7-8', 'Heavier working weight than base phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '7', 'Push the finisher set closer to failure.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Push', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell bench press'), 5, 10, 12, 'rpe', '8', 'Added a set from base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 4, 10, 12, 'rpe', '8', 'Primary shoulder work today, heavier than base phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell overhead press'), 3, 8, 10, 'rpe', '7', 'Second exposure, kept slightly lighter.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Pull', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cable row'), 5, 10, 12, 'rpe', '8', 'Added a set from base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Chin-up'), 4, 6, 10, 'rpe', '8', 'Add load if needed to stay in this rep range.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Legs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Leg press'), 5, 10, 12, 'rpe', '8', 'Added a set from base phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Bulgarian split squat'), 4, 10, 12, 'rpe', '8', 'Heavier per-leg loading than base phase.'),
    (v_session_id, 3, (select id from exercises where name = 'Hanging leg raise'), 3, 10, 15, 'rpe', '7-8', 'Slightly higher rep target than base phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak Volume', 'Highest volume and effort of the program before the next rotation.', 3, 'RIR 0-1 on final sets', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Push', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 5, 8, 10, 'rpe', '9', 'Final push-day intensity before rotating to a new program.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell overhead press'), 4, 8, 10, 'rpe', '9', 'Push the last set close to failure.'),
    (v_session_id, 3, (select id from exercises where name = 'Dumbbell shoulder press'), 3, 10, 12, 'rpe', '8', 'Support volume, still hard.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Pull', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell row'), 5, 8, 10, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 4, 6, 10, 'rpe', '9', 'Push the last set close to failure.'),
    (v_session_id, 3, (select id from exercises where name = 'Lat pulldown'), 3, 10, 12, 'rpe', '8', 'Support volume, still hard.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Legs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 8, 10, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell Romanian deadlift'), 4, 10, 12, 'rpe', '9', 'Push the last set close to failure with strict form.'),
    (v_session_id, 3, (select id from exercises where name = 'Leg extension'), 3, 12, 15, 'rpe', '8', 'Finisher volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Push', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell bench press'), 5, 10, 12, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell shoulder press'), 4, 10, 12, 'rpe', '9', 'Push the last set close to failure.'),
    (v_session_id, 3, (select id from exercises where name = 'Barbell overhead press'), 3, 8, 10, 'rpe', '8', 'Second exposure, still hard.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Pull', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Cable row'), 5, 10, 12, 'rpe', '9', 'Peak-phase intensity.'),
    (v_session_id, 2, (select id from exercises where name = 'Chin-up'), 4, 6, 10, 'rpe', '9', 'Push the last set close to failure.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Legs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Leg press'), 5, 10, 12, 'rpe', '9', 'Final leg day before rotating to a new program.'),
    (v_session_id, 2, (select id from exercises where name = 'Bulgarian split squat'), 4, 10, 12, 'rpe', '9', 'Push the last set close to failure per leg.'),
    (v_session_id, 3, (select id from exercises where name = 'Hanging leg raise'), 4, 10, 15, 'rpe', '8', 'Added a set from volume-ramp.');


  -- =========================================================
  -- Program 3: German Volume Training (advanced, 3x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('hypertrophy', 'hypertrophy-german-volume', 'German Volume Training',
     'A high-volume 10x10 approach: one main lift per muscle group taken to ten sets of ten, for a severe, time-efficient volume overload.',
     'In the spirit of German Volume Training (10x10), a well-known high-volume hypertrophy method.',
     'advanced', 3, 3, array['Barbell', 'Dumbbells', 'Full gym access'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Introduction', 'Introduce the 10x10 protocol at a manageable percentage before the full volume shock.', 3, 'Fixed load at ~50-55% of 10RM, RIR 3-4', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Legs + Abs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 10, 10, 10, 'percent_1rm', '50-55', 'Rest exactly 90 seconds between sets -- the short rest is the point of this method.'),
    (v_session_id, 2, (select id from exercises where name = 'Hanging leg raise'), 3, 12, 15, 'rpe', '6', 'Light finisher -- the squats are the main event.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Chest + Back', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 10, 10, 10, 'percent_1rm', '50-55', 'Same 90-second rest protocol.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 10, 10, 10, 'percent_1rm', '50-55', 'Superset or alternate with the bench sets to manage session length.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Shoulders + Arms', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell shoulder press'), 10, 10, 10, 'percent_1rm', '50-55', 'Same 90-second rest protocol.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '6', 'Light arm/back finisher.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Full Volume', 'The complete 10x10 protocol at the intended working load.', 5, 'Fixed load at ~60% of 10RM, RIR 2-3', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Legs + Abs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 10, 10, 10, 'percent_1rm', '60', 'Expect later sets to be a real grind to hit all 10 reps -- that''s expected at this volume.'),
    (v_session_id, 2, (select id from exercises where name = 'Hanging leg raise'), 3, 12, 15, 'rpe', '7', 'Finisher volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Chest + Back', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 10, 10, 10, 'percent_1rm', '60', 'Full working load -- this is the core stimulus of the program.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 10, 10, 10, 'percent_1rm', '60', 'Full working load.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Shoulders + Arms', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell shoulder press'), 10, 10, 10, 'percent_1rm', '60', 'Full working load.'),
    (v_session_id, 2, (select id from exercises where name = 'Dumbbell row'), 3, 10, 12, 'rpe', '7', 'Finisher volume.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Deload & Consolidate', 'Sharply reduced volume to absorb the accumulated fatigue before the next program.', 2, 'Reduced sets, RIR 4+', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Legs + Abs', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 8, 10, 'rpe', '6', 'Big drop in volume -- let the legs recover.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Chest + Back', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell bench press'), 4, 8, 10, 'rpe', '6', 'Deload volume.'),
    (v_session_id, 2, (select id from exercises where name = 'Barbell row'), 4, 8, 10, 'rpe', '6', 'Deload volume.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Shoulders + Arms', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Dumbbell shoulder press'), 4, 8, 10, 'rpe', '6', 'Deload volume -- next program starts fresh after this.');

end $$;
