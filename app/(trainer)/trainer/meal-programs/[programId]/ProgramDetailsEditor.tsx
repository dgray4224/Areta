"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMealProgram } from "@/domains/trainermealprogram/service";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function ProgramDetailsEditor({
  programId,
  name: initialName,
  description: initialDescription,
}: {
  programId: string;
  name: string;
  description: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{initialName}</h2>
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-neutral-500 hover:underline">
            Edit
          </button>
        </div>
        {initialDescription ? <p className="text-sm text-neutral-600 dark:text-neutral-400">{initialDescription}</p> : null}
      </div>
    );
  }

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateMealProgram(programId, { name, description });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <FormField label="Program name" htmlFor="edit-name">
        <TextInput id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
      </FormField>
      <FormField label="Description" htmlFor="edit-description">
        <TextArea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending || !name} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
