-- Retrofits alternates onto a representative set of existing
-- cardio/conditioning slots (see docs/training-content-pipeline.md) --
-- hand-written, not routed through the content-spec/credibility-gate
-- pipeline, since attaching swap options to already-shipped, already-
-- cited programs isn't a new sourced methodology claim, just additional
-- structural data using exercises already in the library.
--
-- Deliberately excludes triathlete: each of its sessions (Swim/Bike/Run/
-- Brick) is discipline-specific by design -- a triathlete's "Bike" day
-- needs to be on the bike, not swapped for a run, so modality alternates
-- would undermine the program's own purpose there.
--
-- Each target row is identified precisely (program slug + phase_order +
-- session_index, plus exercise_order where a session has more than one
-- exercise) rather than by exercise name alone, since the same exercise
-- name appears in many unrelated slots across the library.

do $$
declare
  v_session_id uuid;
  v_primary_id uuid;
begin

  -- 1. general-fitness-balanced / phase 1 / Cardio A / Easy-pace run
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'general-fitness-balanced' and tpp.phase_order = 1 and ps.session_index = 2 and e.name = 'Easy-pace run';
  if v_primary_id is null then raise exception 'Target 1 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 25, 'easy, steady effort', 'Same aerobic stimulus, easier on the joints.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 20, 'easy, continuous effort', 'A full-body alternative at the same easy effort.', v_primary_id);

  -- 2. general-fitness-balanced / phase 1 / Cardio B / Stationary bike steady-state
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'general-fitness-balanced' and tpp.phase_order = 1 and ps.session_index = 4 and e.name = 'Stationary bike steady-state';
  if v_primary_id is null then raise exception 'Target 2 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 20, 'conversational pace', 'Same easy effort, on foot instead.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 20, 'easy, continuous effort', 'A full-body alternative at the same easy effort.', v_primary_id);

  -- 3. runner-base-building / phase 1 / Easy Run (session 1) / Easy-pace run
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'runner-base-building' and tpp.phase_order = 1 and ps.session_index = 1 and e.name = 'Easy-pace run';
  if v_primary_id is null then raise exception 'Target 3 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 30, 'easy, steady effort', 'Low-impact cross-training day -- keeps the aerobic stimulus without the pounding.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 25, 'continuous, easy effort', 'Zero-impact cross-training alternative.', v_primary_id);

  -- 4. runner-interval-peaking / phase 1 / Interval Session / Treadmill intervals
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'runner-interval-peaking' and tpp.phase_order = 1 and ps.session_index = 2 and e.name = 'Treadmill intervals';
  if v_primary_id is null then raise exception 'Target 4 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 6, 3, '6 x 3 min hard, 2 min easy', 'Same interval structure, off the legs for a day.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Cycling threshold intervals'), null, 35, '6 x 3 min hard, 2 min easy spin', 'Bike-based high-intensity alternative.', v_primary_id);

  -- 5. hybrid-concurrent / phase 1 / Conditioning / Rowing intervals
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'hybrid-concurrent' and tpp.phase_order = 1 and ps.session_index = 2 and e.name = 'Rowing intervals';
  if v_primary_id is null then raise exception 'Target 5 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Assault bike sprints'), 1, '6 x 1 min hard, 1 min easy', null, v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), null, '6 x 3 min hard, 2 min easy', 'Same conditioning stimulus, on foot instead.', v_primary_id);

  -- 6. hybrid-concurrent / phase 1 / Easy Aerobic / Easy-pace run
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'hybrid-concurrent' and tpp.phase_order = 1 and ps.session_index = 4 and e.name = 'Easy-pace run';
  if v_primary_id is null then raise exception 'Target 6 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 30, 'easy, steady effort', 'Same recovery-day intent, easier on the legs.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 25, 'continuous, easy effort', 'Zero-impact recovery-day alternative.', v_primary_id);

  -- 7. cyclist-aerobic-base / phase 1 / Easy Ride (session 1) / Stationary bike steady-state
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'cyclist-aerobic-base' and tpp.phase_order = 1 and ps.session_index = 1 and e.name = 'Stationary bike steady-state';
  if v_primary_id is null then raise exception 'Target 7 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Easy-pace run'), 25, 'conversational pace', 'Cross-training day off the bike.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 25, 'continuous, easy effort', 'Zero-impact cross-training alternative.', v_primary_id);

  -- 8. cyclist-threshold-climbing / phase 1 / Threshold Intervals / Cycling threshold intervals
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'cyclist-threshold-climbing' and tpp.phase_order = 1 and ps.session_index = 2 and e.name = 'Cycling threshold intervals';
  if v_primary_id is null then raise exception 'Target 8 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), 40, '3 x 8 min at threshold effort, easy jog recovery', 'Same threshold stimulus, off the bike.', v_primary_id);
  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Rowing intervals'), 3, 8, '3 x 8 min at threshold effort, easy row recovery', 'Full-body threshold alternative.', v_primary_id);

  -- 9. functional-mixed-modal / phase 1 / Conditioning Priority / Assault bike sprints (exercise_order 2)
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'functional-mixed-modal' and tpp.phase_order = 1 and ps.session_index = 4 and e.name = 'Assault bike sprints' and pse.exercise_order = 2;
  if v_primary_id is null then raise exception 'Target 9 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 2, (select id from exercises where name = 'Rowing intervals'), 5, 1, '5 x 1 min hard, 1 min easy', null, v_primary_id),
    (v_session_id, 2, (select id from exercises where name = 'Double-unders'), 5, null, '5 rounds of 30 reps, rest as needed between rounds', 'Skill-based conditioning alternative.', v_primary_id);

end $$;
