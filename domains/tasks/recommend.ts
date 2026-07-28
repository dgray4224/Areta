import type { TaskStatus } from "@/domains/tasks/schema";

export type TaskSummary = {
  id: string;
  title: string;
  isRequired: boolean;
  priority: number | null;
  status: TaskStatus;
};

/**
 * Deterministic "highest-leverage next action" pick (CLAUDE.md §7 Layer 3 —
 * deterministic code, not an LLM, for anything code can compute). This is
 * intentionally simple: required tasks before optional, lower priority
 * number first. Phase 4 replaces this with a real recommendation engine
 * informed by adherence history and goal progress.
 */
export function recommendNextAction(tasks: TaskSummary[]): string | null {
  const byPriority = (a: TaskSummary, b: TaskSummary) => (a.priority ?? 99) - (b.priority ?? 99);
  const actionable = tasks.filter((t) => t.status === "planned");

  const required = actionable.filter((t) => t.isRequired).sort(byPriority);
  if (required.length > 0) return required[0].title;

  const optional = actionable.filter((t) => !t.isRequired).sort(byPriority);
  if (optional.length > 0) return optional[0].title;

  return null;
}
