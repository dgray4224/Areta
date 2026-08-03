-- Content-quality audit (requested after the Treadmill-intervals /
-- Double-unders display bug fixed in 0046/0047): swept every
-- interval-structured cardio row for the same "duration_minutes set to
-- the per-interval length instead of sets" gap, using
-- duration_minutes = <parsed per-interval minutes from cardio_intensity>
-- as the detection signal (the same signature 0046/0047 fixed). Exactly
-- one further row matched: hybrid-concurrent's "Assault bike sprints"
-- alternate (to its "Rowing intervals" primary), duration_minutes=1
-- matching the "1 min" in "6 x 1 min hard, 1 min easy" -- same bug,
-- same fix as 0047.

update program_session_exercises
set sets = 6
where id = '82473e8f-5873-4a90-b567-b570648383a9';
