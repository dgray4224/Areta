-- Citation trail for training_programs, feeding the on-demand content
-- pipeline's credibility gate (docs/training-content-pipeline.md).
-- Shared platform reference data (CLAUDE.md rule 3), same shape as
-- training_programs itself: select-for-all RLS, writes only via
-- migration/service role.

create table public.program_sources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.training_programs (id) on delete cascade,
  organization text not null,
  title text not null,
  url text not null,
  retrieved_at date not null,
  created_at timestamptz not null default now()
);

alter table public.program_sources enable row level security;

create policy "program_sources_select_all" on public.program_sources
  for select using (true);

create index program_sources_program_idx on public.program_sources (program_id);
