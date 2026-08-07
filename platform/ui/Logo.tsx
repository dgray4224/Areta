export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#c85a3a" />
      <path d="M32 8 L54 56 L41 56 L37 45 L27 45 L23 56 L10 56 Z" fill="#1c130f" />
      <rect x="25" y="39" width="14" height="6" fill="#c85a3a" />
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
