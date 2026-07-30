import { z } from "zod";

/** CLAUDE.md §7 Layer 4 — Durable Memory. Concise, evidence-backed facts
 * accumulated over time (mostly from Smart Contextual Prompts answers)
 * rather than asked all at once in a weekly form. */
export const MEMORY_TYPES = [
  "preference",
  "constraint",
  "successful_strategy",
  "failed_strategy",
  "stable_schedule",
  "motivation",
  "communication_preference",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const createMemorySchema = z.object({
  type: z.enum(MEMORY_TYPES),
  content: z.string().min(1),
  evidence: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;

export type Memory = {
  id: string;
  type: MemoryType;
  content: string;
  evidence: string | null;
  confidence: number;
  createdAt: string;
  lastConfirmedAt: string | null;
  reviewDate: string | null;
  userConfirmed: boolean;
};
