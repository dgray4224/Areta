export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#2a78d6" />
      <path d="M20 26a12 12 0 0 1 21-8" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M41 12v8h-8"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M44 38a12 12 0 0 1-21 8" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
      <path
        d="M23 52v-8h8"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <LogoMark size={size} />
      LifeOS
    </span>
  );
}
