export type Theme = "system" | "light" | "dark";

/** Inlined verbatim into a blocking <script> in the root layout so the
 * correct class is on <html> before first paint — a client-side effect
 * runs too late and causes a flash. Kept as a template-literal-safe plain
 * string (no imports) since it's serialized into the HTML response. */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(s!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** Applies a theme choice: updates the `.dark` class Tailwind's custom
 * `dark:` variant reads, and persists it (or clears the override for
 * "system", falling back to the live OS preference). */
export function applyTheme(theme: Theme): void {
  if (theme === "system") {
    window.localStorage.removeItem("theme");
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } else {
    window.localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
}
