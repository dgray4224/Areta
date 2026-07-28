import "server-only";
import { getServerEnv } from "@/platform/env.server";
import type { AIProvider } from "@/platform/ai/provider";
import { AnthropicProvider } from "@/platform/ai/anthropic-provider";
import { UnimplementedAIProvider } from "@/platform/ai/stub-provider";

/** Single place that knows which concrete AIProvider to use — domain code
 * imports this, never a specific provider class, so swapping or adding
 * providers (CLAUDE.md §13) never touches domain logic. */
export function getAIProvider(): AIProvider {
  const { ANTHROPIC_API_KEY } = getServerEnv();
  if (!ANTHROPIC_API_KEY) {
    return new UnimplementedAIProvider();
  }
  return new AnthropicProvider(ANTHROPIC_API_KEY);
}
