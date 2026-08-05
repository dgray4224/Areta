"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabClass } from "../nav-links";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/personalization", label: "Personalization" },
  { href: "/settings/calendar", label: "Calendar" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/health-data", label: "Health Data" },
  { href: "/settings/account", label: "Account" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2 text-sm ${navTabClass(active)}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
