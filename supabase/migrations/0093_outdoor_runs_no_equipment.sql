-- Found by the goal-first engine's E2E harness
-- (scripts/verify-goalfirst-engine.ts): outdoor-capable runs were
-- seeded with equipment_required = {Cardio machine, Bodyweight only},
-- and hasEquipment() treats equipment_required as an AND -- so a
-- bodyweight-only outdoor runner could never be prescribed an easy run
-- and got track speed work in "easy" slots instead. Running outside
-- needs no equipment; the treadmill is an option, not a requirement.
-- (Rides/swims legitimately keep their machine/pool requirements.)
update public.exercises
  set equipment_required = array['Bodyweight only']
  where name in ('Easy-pace run', 'Tempo run', 'Brick run')
    and equipment_required @> array['Cardio machine'];
