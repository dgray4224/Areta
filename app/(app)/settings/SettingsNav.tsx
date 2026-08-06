"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabClass } from "../nav-links";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/personalization", label: "Personalization" },
  { href: "/settings/trainer", label: "Trainer" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/health-data", label: "Health Data" },
  { href: "/settings/account", label: "Account" },
] as const;

/** Admin's own area lives at `/admin`, not `/settings/admin` — this tab is
 * a deliberate jump out of the Settings shell entirely, the same way it
 * would be if it were a plain link. It's the mobile entry point into the
 * admin portal (desktop's is the accent badge in AppHeader); trainers/
 * reviewers reach it this way rather than needing to know the URL. */
const ADMIN_TAB = { href: "/admin", label: "Admin" } as const;

/** Same jump-out pattern as ADMIN_TAB, for a trainer account reaching
 * their own client roster at /trainer — distinct from the plain
 * "Trainer" tab above, which is every user's own "manage who's coaching
 * me" settings page, not the trainer-facing tool. */
const COACHING_TAB = { href: "/trainer", label: "Coaching" } as const;

const JUMP_OUT_HREFS = new Set<string>([ADMIN_TAB.href, COACHING_TAB.href]);

export function SettingsNav({ isAdmin, isTrainer }: { isAdmin: boolean; isTrainer: boolean }) {
  const pathname = usePathname();
  const tabs = [...(isAdmin ? [ADMIN_TAB] : []), ...(isTrainer ? [COACHING_TAB] : []), ...TABS];

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
