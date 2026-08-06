"use client";

import { useState } from "react";
import { NewProgramForm } from "./NewProgramForm";
import { ImportProgramForm } from "./ImportProgramForm";

export function NewProgramTabs() {
  const [tab, setTab] = useState<"scratch" | "import">("scratch");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("scratch")}
          className={`rounded-full px-3 py-1 text-sm ${tab === "scratch" ? "bg-brand-fill text-brand-ink" : "text-neutral-500 hover:underline"}`}
        >
          Start from scratch
        </button>
        <button
          type="button"
          onClick={() => setTab("import")}
          className={`rounded-full px-3 py-1 text-sm ${tab === "import" ? "bg-brand-fill text-brand-ink" : "text-neutral-500 hover:underline"}`}
        >
          Paste an existing program
        </button>
      </div>
      {tab === "scratch" ? <NewProgramForm /> : <ImportProgramForm />}
    </div>
  );
}
