-- Fixes a real display bug in 3 alternate rows added by 0043 and 0045:
-- formatPrescription() (areta-mobile/lib/today-screens/formatPrescription.ts)
-- only renders a cardio-style prescription ("X min (description)") when
-- duration_minutes is non-null AND reps_min/reps_max are null; when all
-- three are null (as these rows were authored), it falls through to the
-- reps-based branch, finds nothing usable, and renders an empty string.
--
-- Two "Treadmill intervals" alternates (hybrid-concurrent's Rowing
-- intervals alt, hybrid-daily-undulating's Rowing intervals alt) get
-- duration_minutes=3, matching how their own primary row encodes the
-- same "6 x 3 min hard, 2 min easy" structure (sets=6, duration_minutes=3
-- per interval) -- consistent with the existing convention, not a new one.
--
-- "Double-unders" (functional-mixed-modal's Assault bike sprints alt) is
-- naturally rep-based ("30 reps" per round), not duration-based, so it
-- gets reps_min/reps_max=30 instead (sets=5 already set) -- hits
-- formatPrescription's other branch ("5 x 30") rather than being forced
-- into a duration field that wouldn't semantically fit.

update program_session_exercises
set duration_minutes = 3
where id in ('d66fbbb6-d5cd-4a80-943e-2685eea322e1', '3f93b2af-c894-47c4-bd8a-b748007cc4d5');

update program_session_exercises
set reps_min = 30, reps_max = 30
where id = '785a60be-526a-4f21-a71b-8f27b8d9ec8b';
