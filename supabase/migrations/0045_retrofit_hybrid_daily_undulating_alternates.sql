-- Follow-up to 0043_retrofit_cardio_alternates.sql: that migration missed
-- hybrid-daily-undulating ("Daily Undulating Hybrid"), the third of the
-- three hybrid_athlete programs -- 0043 only retrofitted hybrid-concurrent.
-- Same convention: hand-written, not routed through the content-spec
-- pipeline (structural data on an already-shipped, already-cited program,
-- not a new sourced methodology claim). Only phase 1 (Introduction) is
-- targeted, matching 0043's scope and this program's current live usage.

do $$
declare
  v_session_id uuid;
  v_primary_id uuid;
begin

  -- 1. hybrid-daily-undulating / phase 1 / Conditioning Priority (session 2) / Rowing intervals
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'hybrid-daily-undulating' and tpp.phase_order = 1 and ps.session_index = 2 and e.name = 'Rowing intervals';
  if v_primary_id is null then raise exception 'Target 1 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, sets, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Assault bike sprints'), 6, 3, '6 x 3 min hard, 2 min easy', 'Same conditioning stimulus, off the legs.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Treadmill intervals'), null, null, '6 x 3 min hard, 2 min easy', 'Same conditioning stimulus, on foot instead.', v_primary_id);

  -- 2. hybrid-daily-undulating / phase 1 / Easy Aerobic (session 4) / Easy-pace run
  select pse.session_id, pse.id into v_session_id, v_primary_id
  from program_session_exercises pse
  join program_sessions ps on ps.id = pse.session_id
  join training_program_phases tpp on tpp.id = ps.phase_id
  join training_programs tp on tp.id = tpp.program_id
  join exercises e on e.id = pse.exercise_id
  where tp.slug = 'hybrid-daily-undulating' and tpp.phase_order = 1 and ps.session_index = 4 and e.name = 'Easy-pace run';
  if v_primary_id is null then raise exception 'Target 2 not found'; end if;

  insert into program_session_exercises (session_id, exercise_order, exercise_id, duration_minutes, cardio_intensity, coaching_notes, primary_exercise_id) values
    (v_session_id, 1, (select id from exercises where name = 'Stationary bike steady-state'), 30, 'easy, steady effort', 'Same recovery-day intent, easier on the legs.', v_primary_id),
    (v_session_id, 1, (select id from exercises where name = 'Steady-state swim'), 25, 'continuous, easy effort', 'Zero-impact recovery-day alternative.', v_primary_id);

end $$;
