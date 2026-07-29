"use client";

import { useEffect } from "react";

/** Keeps the resolved theme correct while the app is open and the user is
 * on "system": listens for OS-level scheme changes and updates the `.dark`
 * class live. Does nothing once an explicit light/dark choice is stored —
 * that always wins. Mounted once near the app root. */
export function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const stored = window.localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") return;
      document.documentElement.classList.toggle("dark", mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return null;
}
