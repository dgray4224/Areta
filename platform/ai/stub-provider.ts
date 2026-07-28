import type { AIProvider } from "@/platform/ai/provider";
import type { StructuredGenerationRequest, StructuredGenerationResult } from "@/platform/ai/types";

/** Fallback used by `getAIProvider()` (platform/ai/get-provider.ts) when no
 * ANTHROPIC_API_KEY is configured — e.g. local dev without a key, or a
 * misconfigured deploy — so a missing key fails loudly at call time instead
 * of silently returning fabricated data. */
export class UnimplementedAIProvider implements AIProvider {
  async generateStructured<T>(
    _request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    throw new Error("AI generation is not implemented until Phase 4.");
  }
}
