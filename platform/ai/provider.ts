import type { StructuredGenerationRequest, StructuredGenerationResult } from "@/platform/ai/types";

/** Verbatim from CLAUDE.md §13. Any future provider (Anthropic, OpenAI, ...)
 * implements this so provider-specific code never spreads through the app. */
export interface AIProvider {
  generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>>;
}
