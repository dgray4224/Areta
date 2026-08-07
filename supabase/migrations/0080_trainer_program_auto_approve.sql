-- Requested 2026-08-06: a trainer who customizes several weeks ahead via
-- the calendar had no way to make that advance work actually reach the
-- client without a separate manual "approve" click every single week,
-- forever, no matter how far ahead they'd already planned. Calendar
-- overrides were already safely saved regardless (this wasn't a data-loss
-- risk) -- the gap was purely the recurring approval friction.
--
-- auto_approve, off by default: when true, generateAndSaveFromTrainerProgram
-- upserts each week straight to status='active' instead of 'draft',
-- whether triggered by the weekly cron or a manual "Regenerate this week"
-- click. This is a deliberate, explicit exception to CLAUDE.md rule 10
-- ("require approval before changing active plans") that the product
-- owner chose after being shown the tradeoff -- not an oversight. The
-- safety rationale: the trainer already reviewed everything through the
-- calendar in advance (the actual review CLAUDE.md rule 10 exists to
-- guarantee happens), so the weekly click was pure friction, not a new
-- decision point each time. It's opt-in per client, bounded by the
-- assignment's own already-mandatory end_date, and toggled off by
-- default for every new assignment.

alter table public.trainer_program_assignments
  add column auto_approve boolean not null default false;
