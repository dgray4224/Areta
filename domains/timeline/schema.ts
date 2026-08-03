import { z } from "zod";

export const createTimelineEventSchema = z.object({
  date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  notes: z.string().max(2000, "Note is too long").optional(),
  scheduledTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
});

export type CreateTimelineEventInput = z.infer<typeof createTimelineEventSchema>;
