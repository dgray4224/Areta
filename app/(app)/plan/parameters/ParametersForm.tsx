"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveGeneratedParameters, type StoredParameter } from "@/domains/parameters/service";

export function ParametersForm({
  userId,
  domain,
  parameters,
  redirectTo,
}: {
  userId: string;
  domain: string;
  parameters: StoredParameter[];
  redirectTo: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(parameters.map((p) => [p.name, String(p.value)]))
  );

  const allApproved = parameters.every((p) => p.approved);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const edits: Record<string, string | number> = {};
      for (const p of parameters) {
        const raw = values[p.name];
        edits[p.name] = typeof p.value === "number" ? Number(raw) : raw;
      }
      const result = await approveGeneratedParameters(userId, domain, edits);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(redirectTo);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {parameters.map((p) => (
        <div
          key={p.name}
          className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{p.rationale}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                p.approved
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                  : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {p.approved ? "Approved" : "Pending approval"}
            </span>
          </div>

          {p.assumptions.length > 0 ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-neutral-500">
              {p.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : null}

          {p.safetyBounds && p.safetyBounds.length > 0 ? (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {p.safetyBounds.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </div>
          ) : null}

          {p.requiresProfessionalApproval ? (
            <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-400">
              Consider confirming this with a healthcare provider before relying on it.
            </p>
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <input
              type={typeof p.value === "number" ? "number" : "text"}
              step="any"
              value={values[p.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [p.name]: e.target.value }))}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            {p.unit ? <span className="shrink-0 text-sm text-neutral-500">{p.unit}</span> : null}
          </div>
          {p.range ? (
            <p className="mt-1 text-xs text-neutral-500">
              Suggested range: {p.range.min}–{p.range.max} {p.unit}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-neutral-400">
            Confidence: {Math.round(p.confidence * 100)}%
            {p.reviewDate ? ` · Review by ${p.reviewDate}` : ""}
          </p>
        </div>
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isPending ? "Saving…" : allApproved ? "Save changes" : "Approve and continue"}
      </button>
    </form>
  );
}
