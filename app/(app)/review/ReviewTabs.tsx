"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navTabClass } from "../nav-links";

const TABS = [
  { key: "summary", label: "Summary", href: "/review" },
  { key: "interview", label: "Interview", href: "/review?tab=interview" },
  { key: "recap", label: "Plan Recap", href: "/review?tab=recap" },
  { key: "streaks", label: "Streaks", href: "/review?tab=streaks" },
  { key: "vitals", label: "Vitals", href: "/review?tab=vitals" },
  { key: "checkin", label: "Check-in", href: "/review?tab=checkin" },
] as const;

/** Shared between /review and /review/brief so the tab strip is
 * consistent whichever one is currently rendering the "Summary" content
 * — /review only ever shows the metrics-while-waiting state or redirects
 * straight to /review/brief once a brief exists (see review/page.tsx),
 * so Summary's active state has to account for both URLs. */
export function ReviewTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeKey = pathname.startsWith("/review/brief") ? "summary" : searchParams.get("tab") ?? "summary";

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
