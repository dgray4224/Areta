/**
 * Three slow-drifting, brand-colored gradient blobs meant to sit behind
 * content in a `relative isolate overflow-hidden` container (the caller's
 * responsibility, same as before this was extracted). Originally written
 * inline for the homepage hero (app/page.tsx) -- promoted here once a second
 * consumer (the auth pages) needed the same effect, so there's one source of
 * truth for the "Tier 3 / elevated" background treatment instead of a
 * second hand-copied version drifting out of sync with the first.
 *
 * `size="hero"` is the original homepage values, unchanged. `size="compact"`
 * is scaled down for a narrow centered column (auth pages) rather than a
 * full-width marketing hero -- full hero-sized blobs behind a max-w-sm card
 * would either get harshly cropped by overflow-hidden or overwhelm the form.
 *
 * Plain server component -- no `"use client"` needed, the drift animation is
 * pure CSS (`.animate-aurora-a/-b/-c` in app/globals.css, which also carries
 * the prefers-reduced-motion override).
 */
export function AuroraBackground({
  size = "hero",
  className,
}: {
  size?: "hero" | "compact";
  className?: string;
}) {
  const wrapperClass = ["pointer-events-none absolute inset-0 -z-10", className]
    .filter(Boolean)
    .join(" ");

  if (size === "compact") {
    return (
      <div aria-hidden="true" className={wrapperClass}>
        <div className="animate-aurora-a absolute -top-16 -left-12 h-64 w-64 rounded-full bg-brand/25 blur-[70px] dark:bg-brand/15" />
        <div className="animate-aurora-b absolute top-4 -right-16 h-56 w-56 rounded-full bg-accent/20 blur-[70px] dark:bg-accent/15" />
        <div className="animate-aurora-c absolute top-40 left-1/4 h-48 w-48 rounded-full bg-hero/8 blur-[70px] dark:bg-hero/25" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={wrapperClass}>
      <div className="animate-aurora-a absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand/30 blur-[100px] dark:bg-brand/20" />
      <div className="animate-aurora-b absolute top-10 -right-32 h-[26rem] w-[26rem] rounded-full bg-accent/25 blur-[100px] dark:bg-accent/20" />
      <div className="animate-aurora-c absolute top-64 left-1/3 h-[22rem] w-[22rem] rounded-full bg-hero/10 blur-[100px] dark:bg-hero/30" />
    </div>
  );
}
