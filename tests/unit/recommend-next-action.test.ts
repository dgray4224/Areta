import { describe, expect, it } from "vitest";
import { recommendNextAction, type TaskSummary } from "@/domains/tasks/recommend";

function task(overrides: Partial<TaskSummary>): TaskSummary {
  return {
    id: "1",
    title: "Untitled",
    isRequired: true,
    priority: null,
    status: "planned",
    ...overrides,
  };
}

describe("recommendNextAction", () => {
  it("picks the lowest-priority-number planned required task", () => {
    const tasks = [
      task({ id: "a", title: "Low priority", priority: 3 }),
      task({ id: "b", title: "High priority", priority: 1 }),
    ];
    expect(recommendNextAction(tasks)).toBe("High priority");
  });

  it("prefers required tasks over optional ones regardless of priority", () => {
    const tasks = [
      task({ id: "a", title: "Optional but urgent", isRequired: false, priority: 1 }),
      task({ id: "b", title: "Required task", isRequired: true, priority: 3 }),
    ];
    expect(recommendNextAction(tasks)).toBe("Required task");
  });

  it("skips tasks that are already completed, skipped, or otherwise not planned", () => {
    const tasks = [
      task({ id: "a", title: "Done already", status: "completed", priority: 1 }),
      task({ id: "b", title: "Still to do", status: "planned", priority: 2 }),
    ];
    expect(recommendNextAction(tasks)).toBe("Still to do");
  });

  it("falls back to an optional task when no required task is actionable", () => {
    const tasks = [
      task({ id: "a", title: "Required but done", isRequired: true, status: "completed" }),
      task({ id: "b", title: "Optional and open", isRequired: false, status: "planned" }),
    ];
    expect(recommendNextAction(tasks)).toBe("Optional and open");
  });

  it("returns null when there is nothing actionable", () => {
    const tasks = [task({ status: "completed" }), task({ status: "skipped" })];
    expect(recommendNextAction(tasks)).toBeNull();
  });

  it("returns null for an empty task list", () => {
    expect(recommendNextAction([])).toBeNull();
  });
});
