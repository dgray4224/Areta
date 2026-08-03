-- Completes the fix started in 0046: those two "Treadmill intervals"
-- alternates still have sets=null, so the corrected formatPrescription()
-- (areta-mobile/lib/today-screens/formatPrescription.ts, which now
-- suppresses the misleading "X min" prefix only when sets > 1 signals
-- an interval/rounds structure) still falls back to showing "3 min
-- (6 x 3 min hard, 2 min easy)" for these two rows specifically. Set
-- sets=6 to match "6 x 3 min hard, 2 min easy", same as their sibling
-- Rowing intervals primary/alternate rows already have.

update program_session_exercises
set sets = 6
where id in ('d66fbbb6-d5cd-4a80-943e-2685eea322e1', '3f93b2af-c894-47c4-bd8a-b748007cc4d5');
