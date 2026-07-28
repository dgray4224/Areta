import type { z } from "zod";

/** Verbatim from CLAUDE.md §5A — every AI-generated operating parameter
 * (calorie targets, study hours, savings contributions, etc.) must carry
 * its provenance and require explicit user approval before it's active. */
export type GeneratedParameter = {
  id: string;
  domain: string;
  name: string;
  value: number | string | boolean | null;
  unit?: string;
  range?: {
    min: number;
    max: number;
  };
  source: "calculation" | "rule" | "ai_inference" | "professional_instruction";
  assumptions: string[];
  rationale: string;
  confidence: number;
  safetyBounds?: string[];
  reviewDate?: string;
  requiresUserApproval: boolean;
  requiresProfessionalApproval?: boolean;
};

export type StructuredGenerationRequest<T> = {
  /** What we're asking the model to produce, in plain language. */
  instructions: string;
  /** Compact, purpose-built context (see CLAUDE.md §9 context builders) —
   * never the full database. */
  context: Record<string, unknown>;
  /** Validates the model's output; a failed parse must not reach the caller
   * as trusted data (CLAUDE.md §20 rule 8). */
  schema: z.ZodType<T>;
};

export type StructuredGenerationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
