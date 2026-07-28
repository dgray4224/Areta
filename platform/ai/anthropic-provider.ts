import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AIProvider } from "@/platform/ai/provider";
import type { StructuredGenerationRequest, StructuredGenerationResult } from "@/platform/ai/types";

const MODEL = "claude-sonnet-5";
const TOOL_NAME = "emit_result";
const MAX_ATTEMPTS = 2;

/**
 * Real AIProvider implementation (CLAUDE.md §13). Uses forced tool-use to
 * get structured JSON back, then validates it against the caller's Zod
 * schema before returning — a failed validation is a failure result, never
 * trusted data (rule 8). No provider-specific code should exist outside
 * this file; callers only see the AIProvider interface.
 */
export class AnthropicProvider implements AIProvider {
  constructor(private readonly apiKey: string) {}

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>> {
    const client = new Anthropic({ apiKey: this.apiKey });
    const jsonSchema = z.toJSONSchema(request.schema, { target: "draft-7" }) as Record<
      string,
      unknown
    >;

    let lastError = "Unknown AI provider error";

    // Forced tool-use occasionally produces output that doesn't satisfy
    // the schema on the first try (a missing field, wrong enum casing).
    // One retry clears most of these without weakening validation itself.
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const message = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: request.instructions,
          messages: [
            {
              role: "user",
              content: `Context:\n${JSON.stringify(request.context, null, 2)}\n\nUse the ${TOOL_NAME} tool to respond.`,
            },
          ],
          tools: [
            {
              name: TOOL_NAME,
              description: "Emit the structured result for this request.",
              input_schema: jsonSchema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: TOOL_NAME },
        });

        const toolUse = message.content.find((block) => block.type === "tool_use");
        if (!toolUse || toolUse.type !== "tool_use") {
          lastError = "Model did not return a tool_use block.";
          continue;
        }

        const parsed = request.schema.safeParse(toolUse.input);
        if (!parsed.success) {
          lastError = `Model output failed schema validation: ${parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ")}`;
          continue;
        }

        return { ok: true, data: parsed.data };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown AI provider error";
      }
    }

    return { ok: false, error: lastError };
  }
}
