-- Deactivates every training_programs row whose strength-type sessions
-- are genuinely authored with fewer than 4 exercises (a real user report:
-- a 2-exercise "workout" -- e.g. squat + bench and nothing else -- reads
-- as basically nothing, not a session). This is the same gap 0049 already
-- addressed for one hybrid_athlete program (see its comment and the
-- README's "Legacy generator truncation fix" entry) -- this migration
-- widens that fix's scope after finding the same 1-3-exercise-per-session
-- pattern across 23 of the system's 27 originally-authored programs
-- (0032-0040), not just the 3 named there.
--
-- Purely additive in spirit, not destructive: no rows are deleted or
-- edited, matching this pipeline's non-negotiable rule (see
-- docs/training-content-pipeline.md) -- is_active=false only removes a
-- program from getEligibleProgramCandidates' pool for *future* program
-- selection (domains/trainingprogram/service.ts /
-- domains/workoutplan/rotation.ts). It does NOT touch any user's already
-- -assigned active plan (getActiveWorkoutPlan reads a plan's own
-- program_id/program_phase_id directly, unfiltered by is_active), so
-- existing users mid-program are unaffected until their own natural
-- program-reselection point (program completed, archetype changed, long
-- gap, or no history) -- see resolveProgression. Getting them onto a
-- full-coverage replacement sooner needs a separate, deliberate action,
-- not a side effect of this migration.
--
-- Every archetype except triathlete (0037 -- already >=4/session
-- throughout) and hybrid_athlete's hybrid-full-coverage-concurrent (0049)
-- is affected. 6 of 8 affected archetypes have ZERO remaining active
-- programs after this (their entire original catalog was thin):
-- powerlifter, long_distance_runner, hybrid_athlete's 3 originals,
-- cyclist, olympic_weightlifter, functional_fitness. general_fitness
-- keeps one (general-fitness-circuit -- a circuit format, not a
-- strength-session-count question). New program selection in a
-- zero-program archetype falls back to the legacy archetype-only
-- generateWorkoutPlan (domains/workoutplan/service.ts) until a
-- full-coverage replacement is authored for that archetype -- tracked as
-- follow-up work, one archetype at a time, same as 0049's process.
--
-- No exception carved out for long_distance_runner/cyclist's "Strength
-- Support" sessions (auxiliary accessory work alongside the archetype's
-- real training) -- explicit product decision to hold every archetype to
-- the same >=4 bar rather than special-case endurance archetypes.

update training_programs
set is_active = false
where slug in (
  -- powerlifter (0032) -- all 3
  'powerlifter-linear-progression',
  'powerlifter-conjugate',
  'powerlifter-rpe-block',

  -- hypertrophy (0033) -- all 3
  'hypertrophy-upper-lower',
  'hypertrophy-push-pull-legs',
  'hypertrophy-german-volume',

  -- general_fitness (0034) -- 2 of 3 (general-fitness-circuit unaffected,
  -- not a strength-session-count question)
  'general-fitness-full-body',
  'general-fitness-balanced',

  -- long_distance_runner (0035) -- all 3
  'runner-base-building',
  'runner-threshold-tempo',
  'runner-interval-peaking',

  -- hybrid_athlete (0036) -- the 3 originals (hybrid-full-coverage-concurrent
  -- from 0049 is already >=4/session and stays active)
  'hybrid-concurrent',
  'hybrid-block-periodization',
  'hybrid-daily-undulating',

  -- cyclist (0038) -- all 3
  'cyclist-aerobic-base',
  'cyclist-threshold-climbing',
  'cyclist-criterium-peaking',

  -- olympic_weightlifter (0039) -- all 3
  'oly-technical-foundations',
  'oly-bulgarian-frequency',
  'oly-western-periodized',

  -- functional_fitness (0040) -- all 3
  'functional-foundational',
  'functional-mixed-modal',
  'functional-competitor-prep'
);
