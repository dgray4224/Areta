import { z } from "zod";

export const TASK_STATUSES = [
  "planned",
  "completed",
  "partially_completed",
  "skipped",
  "deferred",
  "not_applicable",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const createTaskSchema = z.object({
  date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  isRequired: z.boolean(),
  priority: z.number().int().min(1).max(3).optional(),
  domainKey: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  skipReason: z.string().optional(),
});

export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
