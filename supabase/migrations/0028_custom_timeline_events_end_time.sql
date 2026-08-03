-- Custom timeline events can now have both a start and an end time (the
-- mobile "Add event" sheet's optional time picker sets both). Nullable
-- like scheduled_time -- an event with no scheduled_time never has an
-- end_time either. See domains/timeline/service.ts's
-- setTimelineEventScheduledTime for how end_time shifts to preserve the
-- established duration whenever the event is later rescheduled or dragged.

alter table public.custom_timeline_events
  add column end_time time;
