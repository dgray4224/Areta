-- First real content for the 0044 evidence layer (experts -> sources ->
-- expert_claims), which has sat empty since it was created. Seeds the
-- core programming rules the goal-first recommendation engine
-- (domains/recommendation/*) encodes, so generated plans can carry
-- claim-level provenance instead of unexplained numbers.
--
-- Source URLs were each verified live (HTTP 200) on 2026-08-07 and all
-- sit on domains/trainingprogram/source-allowlist.ts domains --
-- rpstrength.com added to that allowlist in this same change. NSCA's
-- own site is bot-gated (403 to non-browser fetchers), so strength-
-- programming claims cite the ACSM position stand and the Schoenfeld
-- repetition-continuum paper instead of nsca.com URLs.
--
-- No generated-ID hardcoding: rows link via slug/canonical_url
-- subselects.

-- ============================================================
-- Experts
-- ============================================================
insert into public.experts (name, slug, entity_type, roles, specialties, official_channels, status, inclusion_reason, reviewed_at)
values
  ('American College of Sports Medicine', 'acsm', 'institution',
   array['certifying_body'], array['exercise prescription', 'aerobic training', 'resistance training'],
   '[{"type":"website","url":"https://acsm.org"}]',
   'approved', 'The de facto standard-setter for exercise prescription (FITT-VP framework, Guidelines for Exercise Testing and Prescription).', now()),
  ('Dr. Mike Israetel / Renaissance Periodization', 'mike-israetel', 'person',
   array['coach', 'researcher'], array['hypertrophy programming', 'training volume'],
   '[{"type":"website","url":"https://rpstrength.com"}]',
   'approved', 'Originator of the MEV/MAV/MRV volume-landmark framework used for hypertrophy volume progression.', now()),
  ('Dr. Andy Galpin', 'andy-galpin', 'person',
   array['researcher', 'coach'], array['exercise physiology', 'human performance'],
   '[{"type":"website","url":"https://andygalpin.com"}]',
   'approved', 'Evidence-based human-performance physiologist; broad strength/conditioning guidance already on the source allowlist.', now()),
  ('Jeff Cavaliere / ATHLEAN-X', 'jeff-cavaliere', 'person',
   array['coach', 'physical_therapist'], array['injury-aware training', 'hypertrophy'],
   '[{"type":"website","url":"https://athleanx.com"}]',
   'approved', 'Physical-therapist-turned-coach; injury-aware exercise selection and substitution guidance.', now()),
  ('Dr. Brad Schoenfeld', 'brad-schoenfeld', 'person',
   array['researcher'], array['hypertrophy', 'resistance training loading'],
   '[{"type":"website","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC7927075/"}]',
   'approved', 'Leading hypertrophy researcher; the repetition-continuum loading evidence base.', now()),
  ('Dr. Stephen Seiler', 'stephen-seiler', 'person',
   array['researcher'], array['endurance training intensity distribution'],
   '[{"type":"website","url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC9299127/"}]',
   'approved', 'Originator of the polarized (80/20) training-intensity-distribution research programme.', now()),
  ('Dr. Jack Daniels', 'jack-daniels', 'person',
   array['coach', 'researcher'], array['long-distance running'],
   '[{"type":"website","url":"https://vdoto2.com"}]',
   'approved', 'Creator of the VDOT training-pace system (Daniels'' Running Formula); already cited by the legacy runner program.', now());

-- ============================================================
-- Sources (each verified HTTP 200 on 2026-08-07)
-- ============================================================
insert into public.sources (canonical_url, title, organization, source_type, expert_id, accessed_at)
values
  ('https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/',
   'ACSM''s Guidelines for Exercise Testing and Prescription',
   'American College of Sports Medicine', 'certifying_body',
   (select id from public.experts where slug = 'acsm'), current_date),
  ('https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx',
   'Developing the P (for Progression) in a FITT-VP Exercise Prescription',
   'ACSM''s Health & Fitness Journal', 'peer_reviewed',
   (select id from public.experts where slug = 'acsm'), current_date),
  ('https://journals.lww.com/acsm-msse/fulltext/2009/03000/progression_models_in_resistance_training_for.26.aspx',
   'ACSM Position Stand: Progression Models in Resistance Training for Healthy Adults',
   'Medicine & Science in Sports & Exercise', 'peer_reviewed',
   (select id from public.experts where slug = 'acsm'), current_date),
  ('https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth',
   'Training Volume Landmarks for Muscle Growth',
   'Renaissance Periodization', 'official_expert_content',
   (select id from public.experts where slug = 'mike-israetel'), current_date),
  ('https://andygalpin.com',
   'Dr. Andy Galpin -- official site and published performance guidance',
   'Andy Galpin', 'official_expert_content',
   (select id from public.experts where slug = 'andy-galpin'), current_date),
  ('https://athleanx.com',
   'ATHLEAN-X -- injury-aware training guidance',
   'ATHLEAN-X', 'official_expert_content',
   (select id from public.experts where slug = 'jeff-cavaliere'), current_date),
  ('https://pmc.ncbi.nlm.nih.gov/articles/PMC7927075/',
   'Loading Recommendations for Muscle Strength, Hypertrophy, and Local Endurance: A Re-Examination of the Repetition Continuum',
   'Sports (Basel) / PubMed Central', 'peer_reviewed',
   (select id from public.experts where slug = 'brad-schoenfeld'), current_date),
  ('https://pmc.ncbi.nlm.nih.gov/articles/PMC9299127/',
   'Effects of 16 weeks of pyramidal and polarized training intensity distributions in well-trained endurance runners',
   'Scandinavian Journal of Medicine & Science in Sports / PubMed Central', 'peer_reviewed',
   (select id from public.experts where slug = 'stephen-seiler'), current_date),
  ('https://vdoto2.com',
   'V.O2 / VDOT training system (Daniels'' Running Formula)',
   'V.O2', 'official_expert_content',
   (select id from public.experts where slug = 'jack-daniels'), current_date);

-- ============================================================
-- Claims -- the programming rules the engine actually enforces.
-- applicable_goals uses domains/exercise/schema.ts EXERCISE_GOALS;
-- applicable_levels uses program_templates.experience_tier values.
-- ============================================================
insert into public.expert_claims
  (expert_id, claim_type, topic, applicable_goals, applicable_levels, normalized_claim, short_rationale, source_id, confidence, review_status, reviewed_at)
values
  ((select id from public.experts where slug = 'mike-israetel'), 'programming_rule', 'weekly_volume_hypertrophy',
   array['build_muscle', 'lose_fat'], array['beginner', 'intermediate', 'advanced'],
   'Most lifters grow best on roughly 10-20 hard sets per muscle group per week, starting near the lower bound and adding volume over a training phase.',
   'The MEV/MAV/MRV volume-landmark framework: begin near minimum effective volume and progress toward maximum adaptive volume within a mesocycle.',
   (select id from public.sources where canonical_url = 'https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'mike-israetel'), 'progression_rule', 'volume_ramp_and_deload',
   array['build_muscle', 'lose_fat', 'get_stronger'], array['beginner', 'intermediate', 'advanced'],
   'Add roughly one set per muscle per week across a phase, then take a reduced-volume deload week before the next phase.',
   'Progressing set volume week-over-week toward MAV, with a deload before reaching maximum recoverable volume, balances stimulus and recovery.',
   (select id from public.sources where canonical_url = 'https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'brad-schoenfeld'), 'programming_rule', 'hypertrophy_rep_range',
   array['build_muscle'], array['beginner', 'intermediate', 'advanced'],
   'Muscle growth is achievable across a wide 6-30 rep range when sets approach failure; 6-12 reps at moderate-to-heavy load is the practical default.',
   'The repetition-continuum evidence shows hypertrophy is load-flexible but effort-dependent; moderate ranges are most time-efficient.',
   (select id from public.sources where canonical_url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7927075/'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'acsm'), 'programming_rule', 'strength_loading',
   array['get_stronger'], array['intermediate', 'advanced'],
   'Maximal strength work centers on multi-joint lifts at higher loads for roughly 1-6 reps across 3 or more sets, with full rest between sets.',
   'ACSM progression-model guidance for trained lifters emphasizes heavy low-rep work on core lifts for strength-specific adaptation.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-msse/fulltext/2009/03000/progression_models_in_resistance_training_for.26.aspx'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'acsm'), 'programming_rule', 'novice_full_body_frequency',
   array['get_stronger', 'build_muscle', 'improve_general_fitness', 'lose_fat'], array['beginner'],
   'Novices respond best to full-body resistance sessions 2-3 days per week at moderate loads before adopting split routines.',
   'ACSM progression models: untrained lifters progress on lower frequency/volume full-body work; splits become useful with advancing status.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-msse/fulltext/2009/03000/progression_models_in_resistance_training_for.26.aspx'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'acsm'), 'progression_rule', 'two_for_two_load_progression',
   array['get_stronger', 'build_muscle'], array['beginner', 'intermediate', 'advanced'],
   'Increase an exercise''s load once you can perform two or more reps beyond target on two consecutive sessions.',
   'The 2-for-2 rule is the standard conservative trigger for load progression in periodized resistance training.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-msse/fulltext/2009/03000/progression_models_in_resistance_training_for.26.aspx'),
   'medium', 'approved', now()),

  ((select id from public.experts where slug = 'acsm'), 'programming_rule', 'aerobic_weekly_dose',
   array['improve_general_fitness', 'lose_fat', 'move_and_feel_better'], array['beginner', 'intermediate', 'advanced'],
   'Adults should accumulate at least 150 minutes of moderate or 75 minutes of vigorous aerobic activity per week.',
   'The ACSM/public-health baseline aerobic dose for health outcomes; general-fitness and fat-loss plans should meet it.',
   (select id from public.sources where canonical_url = 'https://acsm.org/education-resources/books/guidelines-exercise-testing-prescription/'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'acsm'), 'progression_rule', 'start_low_go_slow',
   array['lose_fat', 'build_muscle', 'get_stronger', 'improve_endurance', 'improve_general_fitness', 'move_and_feel_better', 'train_for_event'], array['beginner'],
   'Progress beginners by frequency and duration before intensity -- "start low and go slow" reduces injury and dropout risk.',
   'ACSM FITT-VP progression guidance: volume via time/frequency first; intensity increases come after a tolerance base is built.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'acsm'), 'caution', 'weekly_volume_increase_cap',
   array['lose_fat', 'build_muscle', 'get_stronger', 'improve_endurance', 'improve_general_fitness', 'move_and_feel_better', 'train_for_event'], array['beginner', 'intermediate', 'advanced'],
   'Keep week-over-week increases in training volume or mileage to roughly 10% or less.',
   'A widely-used injury-prevention guideline, most critical for impact-loaded (running) training.',
   (select id from public.sources where canonical_url = 'https://journals.lww.com/acsm-healthfitness/Fulltext/2018/05000/Developing_the_P__for_Progression__in_a_FITT_VP.4.aspx'),
   'medium', 'approved', now()),

  ((select id from public.experts where slug = 'stephen-seiler'), 'programming_rule', 'polarized_intensity_distribution',
   array['improve_endurance', 'train_for_event'], array['beginner', 'intermediate', 'advanced'],
   'Endurance training works best with roughly 80% of weekly volume at easy/low intensity and about 20% at high intensity.',
   'The polarized/pyramidal intensity-distribution evidence base: concentrating hard work into a small share of weekly volume improves performance while limiting injury and overtraining risk.',
   (select id from public.sources where canonical_url = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9299127/'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'jack-daniels'), 'programming_rule', 'easy_mileage_plus_long_run',
   array['improve_endurance', 'train_for_event'], array['beginner', 'intermediate', 'advanced'],
   'Most weekly running should be at a comfortable, conversational pace, anchored by one longer easy session; quality sessions are added sparingly.',
   'The VDOT system''s foundation: aerobic base is built with easy-pace volume, and a weekly long run is the cornerstone session.',
   (select id from public.sources where canonical_url = 'https://vdoto2.com'),
   'high', 'approved', now()),

  ((select id from public.experts where slug = 'andy-galpin'), 'caution', 'novice_high_skill_lifts',
   array['get_stronger', 'build_muscle', 'improve_general_fitness'], array['beginner'],
   'Beginners should establish movement competency with simpler variations before high-skill barbell lifts (Olympic lifts, heavy barbell maxes).',
   'Skill-dependent lifts carry a technique-limited injury risk that beginners have not yet earned the capacity to manage.',
   (select id from public.sources where canonical_url = 'https://andygalpin.com'),
   'medium', 'approved', now()),

  ((select id from public.experts where slug = 'jeff-cavaliere'), 'regression', 'joint_friendly_substitution',
   array['lose_fat', 'build_muscle', 'get_stronger', 'improve_endurance', 'improve_general_fitness', 'move_and_feel_better', 'train_for_event'], array['beginner', 'intermediate', 'advanced'],
   'When an exercise aggravates a joint, substitute a same-pattern variation that offloads the painful range rather than dropping the pattern entirely.',
   'Injury-aware substitution preserves the training stimulus while respecting the limitation -- the engine''s limitation-exclusion plus same-pattern-substitute behavior.',
   (select id from public.sources where canonical_url = 'https://athleanx.com'),
   'medium', 'approved', now());

-- ============================================================
-- Sanity: seeded exactly 7 experts, 9 sources, 13 approved claims.
-- ============================================================
do $$
declare e integer; s integer; c integer;
begin
  select count(*) into e from public.experts;
  select count(*) into s from public.sources;
  select count(*) into c from public.expert_claims where review_status = 'approved';
  if e < 7 or s < 9 or c < 13 then
    raise exception 'evidence seed incomplete: % experts, % sources, % approved claims', e, s, c;
  end if;
end $$;
