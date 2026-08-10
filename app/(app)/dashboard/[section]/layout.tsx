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
import { navTabClass } from "../../nav-links";
import { DomainNav } from "./DomainNav";

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
    <div className="mx-auto max-w-4xl px-4 pt-6">
      <nav className="flex gap-4 border-b border-neutral-200 text-sm dark:border-neutral-800">
        {activeSections.map((key) => (
          <Link
            key={key}
            href={`/dashboard/${key}`}
            className={`-mb-px border-b-2 px-1 pb-2 ${navTabClass(key === section)}`}
          >
            {SECTIONS[key].label}
          </Link>
        ))}
      </nav>

      {activeDomains.length > 0 ? (
        <DomainNav section={section} activeDomains={activeDomains} />
      ) : null}

      <div className="py-6">{children}</div>
    </div>
  );
}
