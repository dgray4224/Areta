"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { navTabClass } from "../nav-links";

const TABS = [
  { key: "insights", label: "Insights", href: "/review" },
  { key: "trends", label: "Trends", href: "/review?tab=trends" },
] as const;

/** Collapsed from 6 tabs (Summary/Interview/Plan Recap/Streaks/Vitals/
 * Check-in) down to 2 (2026-08-12 redesign) — see app/(app)/review/
 * Insights.tsx's doc comment. No more separate /review/brief route: a
 * brief-or-not both render inline under "Insights" now. */
export function ReviewTabs() {
  const searchParams = useSearchParams();
  const activeKey = searchParams.get("tab") === "trends" ? "trends" : "insights";

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-black/5 dark:border-white/5">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${navTabClass(activeKey === tab.key)}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
