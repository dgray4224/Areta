export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#c85a3a" />
      <path d="M32 14 L48 50 L39 50 L35.5 41.5 L28.5 41.5 L25 50 L16 50 Z" fill="#1c130f" />
      <rect x="27" y="37" width="10" height="5" fill="#c85a3a" />
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <LogoMark size={size} />
      Areta
    </span>
  );
}
