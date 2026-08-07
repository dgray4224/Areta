"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProgram } from "@/domains/trainerprogram/service";
import { FormField, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

export function NewProgramForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createProgram({ name, description });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/trainer/programs/${result.data.id}`);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Program name" htmlFor="name">
        <TextInput
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 12-Week Strength Foundation"
          required
        />
      </FormField>
      <FormField label="Description" htmlFor="description" hint="Optional — visible to you only, not the client.">
        <TextArea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Who this is for, methodology notes, anything you want to remember later."
        />
      </FormField>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create program"}
      </Button>
    </form>
  );
}
