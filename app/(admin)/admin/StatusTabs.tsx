import Link from "next/link";
import { navPillClass } from "@/app/(app)/nav-links";

/** Shared status-filter pill row for every admin review-queue list page
 * (experts/claims/limitation-rules). Plain server component — the active
 * state is derived from the URL, not client state, so no "use client"
 * needed. */
export function StatusTabs({
  basePath,
  options,
  current,
}: {
  basePath: string;
  options: readonly { value: string; label: string }[];
  current: string | undefined;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = current === opt.value || (!current && opt.value === "all");
        const href = opt.value === "all" ? basePath : `${basePath}?status=${opt.value}`;
        return (
          <Link
            key={opt.value}
            href={href}
            className={`rounded-full border px-3 py-1 text-xs ${navPillClass(active)}`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
