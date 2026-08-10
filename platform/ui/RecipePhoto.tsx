"use client";

import { useState } from "react";

/** Code-drawn fallback matching areta-mobile's RecipePhoto.tsx — a
 * brand→accent diagonal gradient (both stops at 35% opacity, same as
 * mobile) with a centered fork/knife glyph, rather than a generic gray
 * box or broken-image icon. Hand-drawn rather than an icon library, same
 * convention as platform/ui/icons.tsx. */
function PhotoFallback({ size, radius }: { size: number; radius: number }) {
  const gradientId = `recipe-photo-fallback-${size}`;
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", position: "relative" }}>
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
        <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" opacity={0.35}>
          <path
            d="M6 3v7a2 2 0 0 0 2 2v9M6 3v7M9 3v7M6 10h3M18 3c-1.5 0-3 1.5-3 4v3c0 1 .8 2 2 2v9M17 3v18"
            stroke="var(--foreground)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Recipe photo with a code-drawn fallback — web's first bitmap image
 * anywhere, same milestone areta-mobile hit with its own RecipePhoto.tsx.
 * Recipes without a photo yet (or a URL that fails to load) show the
 * same gradient-swatch language the rest of the app's code-drawn visuals
 * (Logo, hero cards) already use, instead of a broken-image icon.
 */
export function RecipePhoto({
  url,
  size,
  className,
}: {
  url: string | null;
  size: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const radius = size / 4;

  if (!url || failed) {
    return (
      <div className={className}>
        <PhotoFallback size={size} radius={radius} />
      </div>
    );
  }

  return (
    // Recipe photos are externally hosted (Supabase Storage), not local
    // /public assets, and this is a small fixed-size thumbnail rather than
    // a page hero — next/image's optimization pipeline isn't worth the
    // config for this case.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: radius, objectFit: "cover" }}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
