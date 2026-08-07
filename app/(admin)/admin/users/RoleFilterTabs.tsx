import Link from "next/link";
import { navPillClass } from "@/app/(app)/nav-links";

/** Same pill-row pattern as ../StatusTabs (evidence/experts queues), but
 * a dedicated component rather than reusing that one directly -- this
 * page also has a `q` search param (UserSearchBox) that needs preserving
 * across a role-tab click, which StatusTabs' generic basePath+status-only
 * href builder doesn't account for. */
const ROLE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "trainer", label: "Trainers" },
  { value: "admin", label: "Admins" },
  { value: "none", label: "No role" },
] as const;

export function RoleFilterTabs({ q, current }: { q?: string; current?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_OPTIONS.map((opt) => {
        const active = (current ?? "all") === opt.value;
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (opt.value !== "all") params.set("role", opt.value);
        const href = params.size > 0 ? `/admin/users?${params.toString()}` : "/admin/users";
        return (
          <Link key={opt.value} href={href} className={`rounded-full border px-3 py-1 text-xs ${navPillClass(active)}`}>
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
