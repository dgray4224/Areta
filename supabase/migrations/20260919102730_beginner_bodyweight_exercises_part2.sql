-- Part 2 of the beginner bodyweight top-up (see 20260919102707).
--
-- Two movements from that migration were skipped by its canonical_name
-- guard, because the library already had exercises of those names built
-- on equipment: "Single-leg Romanian deadlift" exists as a dumbbell
-- intermediate, and "Standing calf raise" as a full-gym beginner. The
-- guard was right to skip them, but it left hinge still at one beginner
-- bodyweight option and made the only bodyweight calf raise the
-- single-leg version, which is the harder one — backwards for a
-- beginner. These are the same movements under names that say they are
-- the bodyweight variants, matching the existing "Bodyweight squat"
-- convention.
insert into exercises (
  name, canonical_name, aliases, movement_pattern, movement_patterns, archetype_tags, modality,
  unilateral, compound, primary_muscle_groups, secondary_muscle_groups, equipment_required,
  setup_requirements, limitation_tags, contraindication_notes, difficulty, instructions, status
)
select * from (values
  ('Bodyweight single-leg deadlift', 'Bodyweight single-leg deadlift', array['Single-leg RDL, bodyweight','Airplane']::text[], 'hinge', array['hinge'], array['general_fitness','hybrid_athlete'], 'resistance',
   true, true, array['hamstrings','glutes'], array['core'], array['Bodyweight only'],
   array[]::text[], array['lower_back','ankle_or_foot'], 'Hold a wall or chair for balance until the pattern is steady.',
   'beginner', 'Stand on one leg with a soft knee. Hinge at the hip, reaching the free leg straight behind you as the chest lowers, keeping the hips level. Return to standing. Balance is part of the exercise.', 'active'),
  ('Bodyweight calf raise', 'Bodyweight calf raise', array['Two-leg calf raise']::text[], 'calf raise', array['calf_raise'], array['general_fitness'], 'resistance',
   false, false, array['calves'], array[]::text[], array['Bodyweight only'],
   array[]::text[], array['ankle_or_foot'], null,
   'beginner', 'Stand tall with feet hip-width, rise onto the balls of both feet, pause at the top, lower slowly. Hold a wall for balance if needed.', 'active')
) as v(name, canonical_name, aliases, movement_pattern, movement_patterns, archetype_tags, modality,
       unilateral, compound, primary_muscle_groups, secondary_muscle_groups, equipment_required,
       setup_requirements, limitation_tags, contraindication_notes, difficulty, instructions, status)
where not exists (select 1 from exercises e where e.canonical_name = v.canonical_name);
