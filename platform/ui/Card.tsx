import type { HTMLAttributes } from "react";

export function Card({
  tone = "surface",
  className = "",
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "hero" }) {
  const toneClass =
    tone === "hero"
      ? "bg-hero text-hero-ink"
      : "bg-card text-foreground border border-black/5 dark:border-white/5";
  // Soft raised shadow on surface cards only — hero cards are already the
  // page's own high-contrast block and don't need to look "lifted" too.
  const toneStyle = tone === "hero" ? style : { boxShadow: "var(--shadow-card)", ...style };
  return <div className={`rounded-2xl p-4 ${toneClass} ${className}`} style={toneStyle} {...props} />;
}
