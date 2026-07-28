import type { AIProvider } from "@/platform/ai/provider";
import type { StructuredGenerationRequest, StructuredGenerationResult } from "@/platform/ai/types";

/** Phase 0/1 has no AI generation (CLAUDE.md §21). This exists only to prove
 * the `AIProvider` interface compiles against a real consumer shape ahead of
 * Phase 4 — nothing in the app imports it yet, and no AI SDK is installed. */
export class UnimplementedAIProvider implements AIProvider {
  async generateStructured<T>(
    _request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    throw new Error("AI generation is not implemented until Phase 4.");
  }
}
