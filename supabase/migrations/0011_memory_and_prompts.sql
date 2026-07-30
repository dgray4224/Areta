-- Durable Memory (CLAUDE.md §7 Layer 4) and Smart Contextual Prompts: the
-- replacement for the removed weekly-review Q&A form. Small, evidence-backed
-- facts accumulate over time from contextual prompts instead of one static
-- weekly questionnaire.

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (
    type in (
      'preference',
      'constraint',
      'successful_strategy',
      'failed_strategy',
      'stable_schedule',
      'motivation',
      'communication_preference'
    )
  ),
  content text not null,
  evidence text,
  confidence numeric not null default 0.7,
  created_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  review_date date,
  user_confirmed boolean not null default false
);

alter table public.memories enable row level security;

create policy "memories_all_own" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index memories_user_id_idx on public.memories (user_id, created_at desc);


-- Tracks each Smart Contextual Prompt shown to a user, so a trigger that
-- already fired recently doesn't re-fire (cooldown) whether or not the user
-- answered it.
create table public.prompt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trigger_id text not null,
  shown_at timestamptz not null default now(),
  dismissed boolean not null default false,
  answered boolean not null default false,
  memory_id uuid references public.memories (id) on delete set null
);

alter table public.prompt_events enable row level security;

create policy "prompt_events_all_own" on public.prompt_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index prompt_events_user_trigger_idx on public.prompt_events (user_id, trigger_id, shown_at desc);
