import type { HTMLAttributes } from "react";

export function Card({
  tone = "surface",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "hero" }) {
  const toneClass =
    tone === "hero"
      ? "bg-hero text-hero-ink"
      : "bg-card text-foreground border border-black/5 dark:border-white/5";
  return <div className={`rounded-2xl p-4 ${toneClass} ${className}`} {...props} />;
}
