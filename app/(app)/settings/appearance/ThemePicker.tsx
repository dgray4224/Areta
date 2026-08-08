"use client";

import { useState, useSyncExternalStore } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/platform/theme/theme";

const OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: "system", label: "System", description: "Match your OS setting" },
  { value: "light", label: "Light", description: "Always light" },
  { value: "dark", label: "Dark", description: "Always dark" },
];

// Only used to get a correctly-hydrated *initial* value (localStorage
// isn't available during SSR) — same reasoning as platform/ui/charts/colors.ts.
// Nothing outside this component changes the stored theme after mount, so
// there's nothing to subscribe to; onSelect below updates local state
// directly rather than through this store.
function subscribe() {
  return () => {};
}
function getServerSnapshot(): Theme {
  return "system";
}

export function ThemePicker() {
  const initialTheme = useSyncExternalStore(subscribe, getStoredTheme, getServerSnapshot);
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const onSelect = (value: Theme) => {
    setTheme(value);
    applyTheme(value);
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            // Brand-colored when selected, not just a bolder neutral -- the
            // project-wide "active = brand" rule (see platform's nav-links.ts)
            // applies here too, this was the one place still using a plain
            // neutral selected-state before this pass.
            className={`rounded-lg border p-4 text-left transition-colors ${
              active
                ? "border-brand/40 bg-brand/10"
                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
            }`}
          >
            <p className="text-sm font-medium">{option.label}</p>
            <p className="mt-1 text-xs text-neutral-500">{option.description}</p>
          </button>
        );
      })}
    </div>
  );
}
