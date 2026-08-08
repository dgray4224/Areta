/** Minimal line icons for the homepage's pillar cards -- inline SVG, no
 * icon-library dependency, currentColor so they inherit their container's
 * text color (works automatically in both themes). */

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function TargetIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function LeafIcon() {
  return (
    <IconBase>
      <path d="M4.5 19.5c8-1 13-6 14-14-8 1-13 6-14 14Z" />
      <path d="M6 18c2.5-3 5-5.5 9-8.5" />
    </IconBase>
  );
}

export function DumbbellIcon() {
  return (
    <IconBase>
      <rect x="2.5" y="9.5" width="3" height="5" rx="1" />
      <rect x="18.5" y="9.5" width="3" height="5" rx="1" />
      <path d="M5.5 12h2M16.5 12h2" />
      <rect x="7.5" y="7.5" width="2.5" height="9" rx="0.75" />
      <rect x="14" y="7.5" width="2.5" height="9" rx="0.75" />
      <path d="M10 12h4" />
    </IconBase>
  );
}

export function ScheduleIcon() {
  return (
    <IconBase>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3.5M16 3v3.5" />
      <path d="M7.5 13.5h3M7.5 17h5.5" />
    </IconBase>
  );
}
