-- Functional fitness training programs: 3 methodologies, 3 phases each.
-- Best-effort synthesis of well-documented mixed-modal/functional
-- training principles (constantly varied strength + gymnastics +
-- conditioning) -- generic taxonomy, not any single brand's trademarked
-- programming.

do $$
declare
  v_program_id uuid;
  v_phase_id uuid;
  v_session_id uuid;
begin

  -- =========================================================
  -- Program 1: Foundational Functional Fitness (beginner, 3x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('functional_fitness', 'functional-foundational', 'Foundational Functional Fitness',
     'Scaled, fundamental versions of the core functional-fitness movements -- box step-ups instead of jumps, ring rows instead of muscle-ups -- building a safe base before adding intensity.',
     'A beginner-scaled entry point into mixed-modal functional training.',
     'beginner', 3, 3, array['Bodyweight only', 'Dumbbells', 'Full gym access'], 1)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Movement Foundations', 'Learn the fundamental patterns at low intensity before adding speed or load.', 4, 'RPE 5-6', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength + Skill', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 4, 8, 10, 'rpe', '6', 'Builds the squat pattern the thruster will need later.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 4, 5, 8, 'rpe', '6', 'Use a band or assisted variation if needed -- the pattern matters more than reps right now.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 4, 12, 15, 'rpe', '6', 'A steady, moderate pace -- not an all-out effort yet.'),
    (v_session_id, 2, (select id from exercises where name = 'Burpee'), 4, 8, 10, 'rpe', '6', 'Full-body conditioning at a manageable pace.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength + Skill', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Box jump'), 4, 6, 8, 'rpe', '6', 'Step down between reps rather than jumping down, to protect the joints while learning.'),
    (v_session_id, 2, (select id from exercises where name = 'Farmer''s carry'), 3, 0, 0, 'none', null, 'Carry for 30-40m per set, moderate load.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Adding Intensity', 'Push pace and load now that the patterns are established.', 5, 'RPE 6-7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength + Skill', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 4, 8, 10, 'rpe', '7', 'Heavier load than movement-foundations phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 4, 6, 10, 'rpe', '7', 'Less assistance than movement-foundations phase, if using a band.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 4, 15, 15, 'rpe', '7', 'Faster pace than movement-foundations phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Wall ball shot'), 4, 10, 12, 'rpe', '7', 'New this phase -- a squat-to-throw combination movement.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength + Skill', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Box jump'), 4, 8, 10, 'rpe', '7', 'Can begin stepping down more quickly, or jumping down if landing mechanics are solid.'),
    (v_session_id, 2, (select id from exercises where name = 'Farmer''s carry'), 3, 0, 0, 'none', null, 'Carry for 40-50m per set, heavier load than movement-foundations phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'First Benchmark', 'A light, approachable timed effort to mark real progress.', 3, 'RPE 7-8', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength + Skill', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Goblet squat'), 4, 8, 10, 'rpe', '7-8', 'Final progression before the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Pull-up'), 4, 6, 10, 'rpe', '7-8', 'Final progression before the next program.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Benchmark Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Kettlebell swing'), 1, 20, 20, 'rpe', '8', 'For time: 20 swings, 15 wall balls, 20 swings, 15 wall balls -- record your time as a baseline.'),
    (v_session_id, 2, (select id from exercises where name = 'Wall ball shot'), 1, 15, 15, 'rpe', '8', 'Paired with the swings above in the timed benchmark.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength + Skill', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Box jump'), 4, 10, 10, 'rpe', '7-8', 'Final progression before the next program.'),
    (v_session_id, 2, (select id from exercises where name = 'Farmer''s carry'), 3, 0, 0, 'none', null, 'Carry for 50m per set -- heaviest load of the program.');


  -- =========================================================
  -- Program 2: Mixed-Modal Conditioning (intermediate, 5x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('functional_fitness', 'functional-mixed-modal', 'Mixed-Modal Conditioning',
     'Constantly varied sessions blending barbell strength, gymnastics skill, and metabolic conditioning -- the classic three-pronged functional-fitness structure.',
     'A constantly-varied mixed-modal approach blending strength, gymnastics, and conditioning across the week.',
     'intermediate', 4, 5, array['Barbell', 'Dumbbells', 'Pull-up bar', 'Full gym access'], 2)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Base Rotation', 'Establish the weekly rotation of strength, gymnastics, and conditioning-priority days.', 4, 'RPE 7', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength: Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 5, 5, 'rpe', '7', 'Primary strength lift of the week.'),
    (v_session_id, 2, (select id from exercises where name = 'Double-unders'), 5, 30, 30, 'rpe', '6', 'Skill-conditioning finisher.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Gymnastics + Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Toes-to-bar'), 5, 8, 10, 'rpe', '7', 'Core/grip gymnastics skill work.'),
    (v_session_id, 2, (select id from exercises where name = 'Box jump'), 5, 8, 10, 'rpe', '7', 'Paired conditioning piece.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength: Press', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Push press'), 5, 5, 5, 'rpe', '7', 'Primary pressing strength of the week.'),
    (v_session_id, 2, (select id from exercises where name = 'Chest-to-bar pull-up'), 4, 6, 8, 'rpe', '7', 'Harder pulling variation.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Thruster'), 5, 10, 10, 'rpe', '7', 'The week''s core metabolic conditioning piece.');
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 2, (select id from exercises where name = 'Assault bike sprints'), 5, 1, '5 x 1 min hard, 1 min easy', 'Paired conditioning finisher.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Strength: Hinge', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 4, 5, 5, 'rpe', '7', 'Weekly hinge-pattern strength work.'),
    (v_session_id, 2, (select id from exercises where name = 'Farmer''s carry'), 4, 0, 0, 'none', null, 'Grip/carry finisher, 40-50m per set.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Volume & Skill Progression', 'Add load to the strength lifts and progress toward harder gymnastics variations.', 5, 'RPE 7-8', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength: Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 4, 5, 'rpe', '8', 'Heavier than base-rotation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Double-unders'), 6, 30, 30, 'rpe', '7', 'Added a round from base-rotation phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Gymnastics + Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Toes-to-bar'), 5, 10, 12, 'rpe', '8', 'Higher rep target than base-rotation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Ring dip'), 4, 6, 8, 'rpe', '7-8', 'New this phase -- a harder pressing skill.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Strength: Press', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Push press'), 5, 4, 5, 'rpe', '8', 'Heavier than base-rotation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Chest-to-bar pull-up'), 4, 6, 8, 'rpe', '8', 'Heavier/harder than base-rotation phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Conditioning Priority', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Thruster'), 6, 10, 10, 'rpe', '8', 'Added a round from base-rotation phase.');
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 2, (select id from exercises where name = 'Assault bike sprints'), 6, 1, '6 x 1 min hard, 1 min easy', 'Added a round from base-rotation phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Strength: Hinge', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 4, 3, 5, 'rpe', '8', 'Heavier than base-rotation phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Sled push'), 4, 20, 20, 'rpe', '8', 'New this phase -- a heavier loaded-carry variant.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Benchmark Week', 'A capstone timed workout blending all three qualities before rotating.', 2, 'RPE 8-9', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength Test: Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 3, 5, 'rpe', '9', 'Final strength test before the program rotates.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Gymnastics Test', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Chest-to-bar pull-up'), 1, 0, 0, 'rpe', '9', 'Max unbroken set as a skill benchmark.'),
    (v_session_id, 2, (select id from exercises where name = 'Ring dip'), 1, 0, 0, 'rpe', '9', 'Max unbroken set as a skill benchmark.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Capstone Metcon', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Thruster'), 1, 21, 21, 'rpe', '9', 'For time: 21-15-9 reps of thrusters and pull-ups.'),
    (v_session_id, 2, (select id from exercises where name = 'Chest-to-bar pull-up'), 1, 21, 21, 'rpe', '9', 'Paired with the thrusters above in the 21-15-9 rep scheme.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Test: Hinge', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 4, 2, 4, 'rpe', '9', 'Final hinge-pattern test before the program rotates.');


  -- =========================================================
  -- Program 3: Competitor Prep (advanced, 6x/week)
  -- =========================================================
  insert into training_programs
    (archetype, slug, name, description, methodology_note, experience_level,
     sessions_per_week_min, sessions_per_week_max, equipment_required, display_order)
  values
    ('functional_fitness', 'functional-competitor-prep', 'Competitor Prep',
     'Heavier barbell work, higher-skill gymnastics (muscle-ups, handstand push-ups, rope climbs), and longer conditioning pieces for experienced mixed-modal athletes.',
     'An advanced mixed-modal template layering higher-skill gymnastics and heavier barbell work on top of longer conditioning pieces.',
     'advanced', 5, 6, array['Barbell', 'Dumbbells', 'Pull-up bar', 'Full gym access'], 3)
  returning id into v_program_id;

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 1, 'Skill & Strength Build', 'Build the heavier barbell numbers and higher-skill gymnastics reps this program relies on.', 4, 'RPE 7-8', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Heavy Squat + Gymnastics', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 3, 5, 'rpe', '8', 'Heavier rep range than an intermediate mixed-modal program.'),
    (v_session_id, 2, (select id from exercises where name = 'Muscle-up'), 5, 3, 5, 'rpe', '7-8', 'Scale to banded or jumping muscle-ups if unbroken reps aren''t there yet.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Long Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rope climb'), 5, 2, 3, 'rpe', '8', 'Higher-skill grip/pulling conditioning.'),
    (v_session_id, 2, (select id from exercises where name = 'Devil press'), 5, 10, 10, 'rpe', '8', 'Full-body conditioning finisher.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Heavy Press + Gymnastics', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Push press'), 5, 3, 5, 'rpe', '8', 'Heavier than an intermediate program.'),
    (v_session_id, 2, (select id from exercises where name = 'Handstand push-up'), 5, 5, 8, 'rpe', '7-8', 'Scale kick-up height or use a deficit as skill allows.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Heavy Hinge + Carries', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 5, 3, 5, 'rpe', '8', 'Heavier than an intermediate program.'),
    (v_session_id, 2, (select id from exercises where name = 'Sled push'), 5, 25, 25, 'rpe', '8', 'Heavier loaded conditioning.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Olympic Lift Exposure', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Power clean'), 5, 3, 3, 'rpe', '7', 'Olympic-lift derivative common in higher-level mixed-modal programming.'),
    (v_session_id, 2, (select id from exercises where name = 'Overhead squat'), 4, 3, 5, 'rpe', '7', 'A demanding stability and mobility movement.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Long Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Assault bike sprints'), 8, 1, '8 x 1 min hard, 1 min easy', 'Longer conditioning piece to close the week.');
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 2, (select id from exercises where name = 'Wall ball shot'), 8, 12, 12, 'rpe', '8', 'Paired with the bike intervals.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 2, 'Intensification', 'Heavier barbell loads and longer, harder conditioning pieces.', 5, 'RPE 8-9', false)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Heavy Squat + Gymnastics', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 5, 2, 4, 'rpe', '9', 'Heavier than skill-and-strength-build phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Muscle-up'), 5, 4, 6, 'rpe', '8-9', 'More reps than skill-and-strength-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Long Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Rope climb'), 6, 2, 3, 'rpe', '9', 'Added a round from skill-and-strength-build phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Devil press'), 6, 10, 10, 'rpe', '9', 'Added a round from skill-and-strength-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Heavy Press + Gymnastics', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Push press'), 5, 2, 4, 'rpe', '9', 'Heavier than skill-and-strength-build phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Handstand push-up'), 5, 6, 10, 'rpe', '8-9', 'More reps than skill-and-strength-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Heavy Hinge + Carries', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 5, 2, 4, 'rpe', '9', 'Heavier than skill-and-strength-build phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Sled push'), 5, 30, 30, 'rpe', '9', 'Heavier/longer than skill-and-strength-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 5, 'Olympic Lift Exposure', 'weightlifting') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Power clean'), 5, 2, 3, 'rpe', '8', 'Heavier than skill-and-strength-build phase.'),
    (v_session_id, 2, (select id from exercises where name = 'Overhead squat'), 4, 3, 5, 'rpe', '8', 'Heavier than skill-and-strength-build phase.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 6, 'Long Conditioning', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Assault bike sprints'), 10, 1, '10 x 1 min hard, 1 min easy', 'Longer than skill-and-strength-build phase.');
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 2, (select id from exercises where name = 'Wall ball shot'), 10, 12, 12, 'rpe', '9', 'Longer than skill-and-strength-build phase.');

  insert into training_program_phases (program_id, phase_order, name, focus, length_weeks, intensity_style, is_final)
  values (v_program_id, 3, 'Peak & Test', 'The hardest version of every session type, closing with a full capstone test.', 2, 'RPE 9-10', true)
  returning id into v_phase_id;

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 1, 'Strength Test: Squat', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell back squat'), 4, 1, 3, 'rpe', '9-10', 'Peak-phase test before the program rotates.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 2, 'Gymnastics Test', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Muscle-up'), 1, 0, 0, 'rpe', '9', 'Max unbroken set as a skill benchmark.'),
    (v_session_id, 2, (select id from exercises where name = 'Handstand push-up'), 1, 0, 0, 'rpe', '9', 'Max unbroken set as a skill benchmark.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 3, 'Capstone Metcon', 'conditioning') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Thruster'), 1, 15, 15, 'rpe', '10', 'For time: 5 rounds of 15 thrusters, 15 chest-to-bar pull-ups, 200m row/run equivalent.'),
    (v_session_id, 2, (select id from exercises where name = 'Chest-to-bar pull-up'), 1, 15, 15, 'rpe', '10', 'Paired with the thrusters above.');

  insert into program_sessions (phase_id, session_index, name, session_type) values (v_phase_id, 4, 'Strength Test: Hinge', 'strength') returning id into v_session_id;
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, reps_min, reps_max, intensity_type, intensity_value, coaching_notes) values
    (v_session_id, 1, (select id from exercises where name = 'Barbell deadlift'), 4, 1, 3, 'rpe', '9-10', 'Final strength test before the program rotates.');

end $$;
