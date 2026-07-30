"use client";

import { useState } from "react";

export const chipBase =
  "rounded-full border px-3 py-1 text-xs transition-colors";
export const chipSelected = "border-brand-fill bg-brand-fill text-brand-ink";
export const chipUnselected =
  "border-neutral-300 bg-transparent text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600";

const fieldClass =
  "mt-1 w-full rounded-xl border border-neutral-300 bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-neutral-700";

/**
 * "Select all that apply" picker: suggested options render as toggle chips,
 * and a text input lets the user add anything not on the list. Not a native
 * form element, so it's a controlled string[] component — wire it up with
 * react-hook-form's `Controller`, not `register`.
 */
export function TagPicker({
  id,
  suggestions,
  value,
  onChange,
  placeholder = "Add your own…",
}: {
  id?: string;
  suggestions: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const toggle = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((v) => v !== tag) : [...value, tag]);
  };

  const addCustom = () => {
    const typed = draft.trim();
    if (!typed) return;
    const matchingSuggestion = suggestions.find(
      (s) => s.toLowerCase() === typed.toLowerCase()
    );
    const tag = matchingSuggestion ?? typed;
    if (!value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft("");
  };

  const customTags = value.filter((v) => !suggestions.includes(v));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`${chipBase} ${value.includes(s) ? chipSelected : chipUnselected}`}
          >
            {s}
          </button>
        ))}
        {customTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={`${chipBase} ${chipSelected}`}
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={placeholder}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={addCustom}
          className="mt-1 shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          Add
        </button>
      </div>
    </div>
  );
}
