import Link from "next/link";
import { Logo } from "@/platform/ui/Logo";
import { AuroraBackground } from "@/platform/ui/AuroraBackground";

/**
 * Tier-3 treatment (design-system-scoping artifact, Phase 1) -- previously
 * flat bg-neutral-50/950, predating the design-token system entirely.
 * `size="compact"` since these are narrow centered forms, not a full-width
 * marketing hero (see AuroraBackground's own doc comment for the reasoning).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-canvas">
      <AuroraBackground size="compact" />
      <Link href="/">
        <Logo size={28} />
      </Link>
      {children}
    </div>
  );
}
