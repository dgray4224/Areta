"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabClass } from "@/app/(app)/nav-links";

const TABS = [
  { href: "/admin/ops/ai-runs", label: "AI runs" },
  { href: "/admin/ops/cron", label: "Cron health" },
  { href: "/admin/ops/audit-log", label: "Audit log" },
] as const;

export function OpsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
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
