"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOMAIN_LABELS } from "@/domains/goals/schema";
import type { DomainKey } from "@/domains/goals/schema";
import type { SectionKey } from "@/platform/ui/sections";
import { navPillClass } from "../../nav-links";

export function DomainNav({
  section,
  activeDomains,
}: {
  section: SectionKey;
  activeDomains: DomainKey[];
}) {
  const pathname = usePathname();
  const overviewHref = `/dashboard/${section}`;

  return (
    <nav className="flex gap-3 pt-3 text-xs">
      <Link href={overviewHref} className={`rounded-full border px-3 py-1 ${navPillClass(pathname === overviewHref)}`}>
        Overview
      </Link>
      {activeDomains.map((domain) => {
        const href = `/dashboard/${section}/${domain}`;
        return (
          <Link key={domain} href={href} className={`rounded-full border px-3 py-1 ${navPillClass(pathname === href)}`}>
            {DOMAIN_LABELS[domain]}
          </Link>
        );
      })}
    </nav>
  );
}
