"use client";

import { useState } from "react";

/** Code-drawn fallback matching areta-mobile's AvatarPhoto.tsx and this
 * app's own RecipePhoto.tsx -- same brand->accent diagonal gradient (both
 * stops at 35% opacity) as the recipe fallback, just circular instead of
 * rounded-rect since this represents a person, with a centered head/
 * shoulders glyph instead of a fork/knife. Drawn inline rather than
 * pulled from platform/ui/icons.tsx, same as RecipePhoto -- that file is
 * documented as nav-shell icons specifically, this is a photo fallback. */
function AvatarFallback({ size }: { size: number }) {
  const gradientId = `avatar-photo-fallback-${size}`;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", position: "relative" }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--accent)" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <rect width={size} height={size} fill={`url(#${gradientId})`} />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" opacity={0.35}>
          <circle cx="12" cy="8" r="4" stroke="var(--foreground)" strokeWidth="1.8" />
          <path
            d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6"
            stroke="var(--foreground)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Profile photo with a code-drawn fallback -- web's counterpart to
 * areta-mobile's AvatarPhoto.tsx, following the same convention this app
 * already established with RecipePhoto.tsx (gradient-swatch language
 * instead of a broken-image icon when there's no photo yet or the URL
 * fails to load).
 */
export function AvatarPhoto({
  url,
  size,
  className,
}: {
  url: string | null;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className={className}>
        <AvatarFallback size={size} />
      </div>
    );
  }

  return (
    // Same reasoning as RecipePhoto: externally hosted (Supabase Storage),
    // small fixed-size thumbnail, not worth next/image's config for this.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
