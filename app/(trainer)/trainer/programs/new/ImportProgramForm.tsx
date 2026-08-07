"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importProgramFromText } from "@/domains/trainerprogram/import";
import { TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function ImportProgramForm() {
  const router = useRouter();
  const [pastedText, setPastedText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onImport = () => {
    setError(null);
    startTransition(async () => {
      const result = await importProgramFromText(pastedText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const warningsParam =
        result.data.warnings.length > 0 ? `?importWarnings=${encodeURIComponent(JSON.stringify(result.data.warnings))}` : "";
      router.push(`/trainer/programs/${result.data.programId}${warningsParam}`);
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Paste a program you&apos;ve already written — a spreadsheet copy-paste, a plain-text list, whatever you
        have. It lands as a draft you can review and edit before publishing, same as building one by hand.
        Exercise names that don&apos;t match your library become new exercises automatically, pending review.
      </p>
      <TextArea
        value={pastedText}
        onChange={(e) => setPastedText(e.target.value)}
        rows={12}
        placeholder={"Phase 1: Foundation (weeks 1-4)\nMonday - Lower Body\nBack Squat 4x6 @ RPE 7\nRomanian Deadlift 3x10\n..."}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" disabled={isPending || !pastedText.trim()} onClick={onImport}>
        {isPending ? "Reading your program…" : "Import"}
      </Button>
    </div>
  );
}
