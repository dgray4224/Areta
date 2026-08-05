"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabClass } from "@/app/(app)/nav-links";
import type { AdminRole } from "@/platform/auth/admin";

/** Content-review tabs (Phase B) are available to both roles — the
 * `experts`/`sources`/`expert_claims`/`limitation_rules` RLS write
 * policies key off `is_admin()`, not role, so reviewers genuinely can
 * act on all of these. Ops/user-management tabs (Phase D/E) don't exist
 * yet; when they're built, gate their entries here on `adminRole ===
 * "owner"` the same way this list would grow, rather than showing a
 * dead link a reviewer can click into and get bounced from. */
const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/experts", label: "Experts" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/claims", label: "Claims" },
  { href: "/admin/limitation-rules", label: "Limitation rules" },
  // Phase C content-management tabs.
  { href: "/admin/content/exercises", label: "Exercises" },
  { href: "/admin/content/recipes", label: "Recipes" },
] as const;

export function AdminNav({ adminRole }: { adminRole: AdminRole }) {
  const pathname = usePathname();
  void adminRole; // no owner-only tabs exist yet — see comment above

  return (
    <nav className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
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
