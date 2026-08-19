-- Annotation loop: what KIND of answer the user gave.
--
-- The loop asks "something changed around this date -- do you know what?".
-- Three answers are all legitimate and they must not be stored the same
-- way:
--
--   life_event   a real change in the person's life. Writes a memories
--                row, which is the whole point of asking.
--   measurement  the data changed, the person did not -- a new watch, a
--                new phone, a second step-counting device. Must NOT
--                become a life_event memory: this account's 2021-02-04
--                "steps rose 2,858 -> 12,016" lands on the exact day the
--                Apple Watch first appears, and recording that as a life
--                change would feed the insight engine a fiction.
--   unknown      the user genuinely does not remember. Recorded so the
--                prompt stops asking, WITHOUT inventing a cause.
--
-- Without this column the only ways to clear a prompt were to make
-- something up or to leave it pending forever.

alter table public.changepoints
  add column if not exists kind text;

alter table public.changepoints
  drop constraint if exists changepoints_kind_check;

alter table public.changepoints
  add constraint changepoints_kind_check
  check (kind is null or kind in ('life_event', 'measurement', 'unknown'));

comment on column public.changepoints.kind is
  'How the user explained this changepoint. NULL = not yet annotated. Only life_event creates a memories row; measurement marks a device/data artifact that downstream generators should discount.';

-- Answered-but-uncaused annotations (measurement, unknown) carry no label
-- text, so "has this been dealt with?" is kind IS NOT NULL, not label IS
-- NOT NULL. Partial index because the loop only ever queries the pending
-- ones, and on a mature account almost every row is answered.
create index if not exists changepoints_pending_annotation_idx
  on public.changepoints (user_id, detected_at)
  where kind is null;
