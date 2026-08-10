"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabClass, ADMIN_LINK, COACHING_LINK } from "../nav-links";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/personalization", label: "Personalization" },
  { href: "/settings/trainer", label: "Trainer" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/health-data", label: "Health Data" },
  { href: "/settings/account", label: "Account" },
] as const;

/** ADMIN_LINK/COACHING_LINK (nav-links.ts) are jump-outs of the Settings
 * shell entirely, same as a plain link — this is the mobile entry point
 * into the admin portal / trainer tool (desktop's is Sidebar's secondary
 * group). Shared with Sidebar so the two can't drift apart. */
const JUMP_OUT_HREFS = new Set<string>([ADMIN_LINK.href, COACHING_LINK.href]);

export function SettingsNav({ isAdmin, isTrainer }: { isAdmin: boolean; isTrainer: boolean }) {
  const pathname = usePathname();
  const tabs = [...(isAdmin ? [ADMIN_LINK] : []), ...(isTrainer ? [COACHING_LINK] : []), ...TABS];

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-800">
      {tabs.map((tab) => {
        const isJumpOut = JUMP_OUT_HREFS.has(tab.href);
        const active = isJumpOut ? pathname.startsWith(tab.href) : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              isJumpOut
                ? "whitespace-nowrap rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:opacity-90"
                : `whitespace-nowrap border-b-2 px-3 py-2 text-sm ${navTabClass(active)}`
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
