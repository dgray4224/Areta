"use client";

import { useState, useTransition } from "react";
import { saveReviewAnswers } from "@/domains/review/service";

/** Question keys must match domains/review/service.ts's ANSWER_MEMORY_TYPE
 * map exactly — that's what maps each answer to a durable-memory type when
 * a brief is generated. Kept in sync with areta-mobile's
 * lib/review-screens/InterviewStep.tsx, which asks the same four
 * questions. */
const QUESTIONS = [
  { key: "wentWell", label: "What went well this week?" },
  { key: "difficult", label: "What was difficult?" },
  { key: "shouldChange", label: "What should change next week?" },
  { key: "scheduleChanges", label: "Any new restrictions, appointments, or schedule changes?" },
] as const;

/**
 * The "lightweight" pre-brief interview — a fixed small set of optional/
 * skippable questions feeding into the AI context and (once a brief is
 * generated) durable memory. Saves on blur, not per keystroke, matching
 * mobile's InterviewStep.tsx so a half-finished answer isn't lost if the
 * tab is switched or closed mid-thought.
 */
export function InterviewSection({
  userId,
  initialAnswers,
  missedTaskReasons,
}: {
  userId: string;
  initialAnswers: Record<string, string>;
  missedTaskReasons: string[];
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [missedTaskCause, setMissedTaskCause] = useState(initialAnswers.missedTaskCause ?? "");
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const save = (key: string, value: string) => {
    if (value.trim() === (initialAnswers[key] ?? "").trim()) return; // unchanged, skip the round trip
    startTransition(async () => {
      const result = await saveReviewAnswers(userId, { [key]: value });
      if (result.ok) {
        setSavedKey(key);
        setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 1500);
      }
    });
  };

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="text-sm font-medium">A few quick questions (optional)</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Your answers help this week&apos;s brief explain the &ldquo;why,&rdquo; not just the &ldquo;what.&rdquo;
      </p>

      <div className="mt-4 space-y-4">
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <label htmlFor={q.key} className="flex items-center justify-between text-sm font-medium">
              {q.label}
              {savedKey === q.key ? <span className="text-xs font-normal text-accent">Saved</span> : null}
            </label>
            <textarea
              id={q.key}
              rows={2}
              placeholder="Optional"
              defaultValue={answers[q.key] ?? ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))}
              onBlur={(e) => save(q.key, e.target.value)}
              disabled={isPending}
              className="mt-1.5 w-full rounded-md border border-neutral-300 bg-card p-2 text-sm dark:border-neutral-700"
            />
          </div>
        ))}

        {missedTaskReasons.length > 0 ? (
          <div>
            <p className="text-sm font-medium">What caused missed tasks?</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {missedTaskReasons.map((reason) => {
                const selected = missedTaskCause === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      const next = selected ? "" : reason;
                      setMissedTaskCause(next);
                      save("missedTaskCause", next);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      selected
                        ? "border-brand bg-brand text-brand-ink"
                        : "border-neutral-300 text-neutral-600 hover:bg-black/[0.03] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
