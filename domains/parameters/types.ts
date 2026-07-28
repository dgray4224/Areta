/** Verbatim shape from CLAUDE.md §5A/§13 — every value LifeOS derives on the
 * user's behalf must be traceable back to its assumptions and reasoning. */
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
