import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import {
  SECTIONS,
  isSectionKey,
  getActiveSections,
  getActiveDomainsForSection,
} from "@/platform/ui/sections";
import { DOMAIN_LABELS } from "@/domains/goals/schema";

export default async function DashboardSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSectionKey(section)) {
    notFound();
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data: domains } = await supabase
    .from("domains")
    .select("key")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const activeDomainKeys = (domains ?? []).map((d) => d.key);
  const activeSections = getActiveSections(activeDomainKeys);
  const activeDomains = getActiveDomainsForSection(section, activeDomainKeys);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <nav className="flex gap-4 border-b border-neutral-200 text-sm dark:border-neutral-800">
        {activeSections.map((key) => (
          <Link
            key={key}
            href={`/dashboard/${key}`}
            className={`-mb-px border-b-2 px-1 pb-2 ${
              key === section
                ? "border-neutral-900 font-medium dark:border-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            }`}
          >
            {SECTIONS[key].label}
          </Link>
        ))}
      </nav>

      {activeDomains.length > 0 ? (
        <nav className="flex gap-3 pt-3 text-xs">
          <Link
            href={`/dashboard/${section}`}
            className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Overview
          </Link>
          {activeDomains.map((domain) => (
            <Link
              key={domain}
              href={`/dashboard/${section}/${domain}`}
              className="rounded-full border border-neutral-200 px-3 py-1 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
            >
              {DOMAIN_LABELS[domain]}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="py-6">{children}</div>
    </div>
  );
}
