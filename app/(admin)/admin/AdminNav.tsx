"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabClass } from "@/app/(app)/nav-links";
import type { AdminRole } from "@/platform/auth/admin";

/** Content-review (Phase B) and content-management (Phase C) tabs are
 * available to both roles — their RLS write policies key off
 * `is_admin()`, not role, so reviewers genuinely can act on all of
 * these. Ops (Phase D) is the first owner-only tab, gated below on
 * `ownerOnly` — matches `requireAdminOwner()` actually enforcing it
 * server-side too, so this isn't just cosmetic hiding.
 *
 * Experts/Sources/Claims/Limitation-rules were four separate tabs until
 * 2026-08-06, merged into one "Evidence" tab (/admin/evidence) — one
 * unified list across all four types plus one combined add-flow, instead
 * of four disconnected forms an admin had to wire together by hand. */
const TABS = [
  { href: "/admin", label: "Overview", ownerOnly: false },
  { href: "/admin/evidence", label: "Evidence", ownerOnly: false },
  { href: "/admin/content/exercises", label: "Exercises", ownerOnly: false },
  { href: "/admin/content/recipes", label: "Recipes", ownerOnly: false },
  { href: "/admin/ops", label: "Ops", ownerOnly: true },
  { href: "/admin/users", label: "Users", ownerOnly: true },
  { href: "/admin/trainer-requests", label: "Trainer Requests", ownerOnly: true },
] as const;

export function AdminNav({ adminRole }: { adminRole: AdminRole }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => !tab.ownerOnly || adminRole === "owner");

  return (
    <nav className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {tabs.map((tab) => {
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
