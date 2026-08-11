import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { SECTIONS, isSectionKey, getActiveSections } from "@/platform/ui/sections";
import { navTabClass } from "../../nav-links";

/**
 * DomainNav's Overview/Nutrition/Exercise sub-tab row is gone -- the
 * consolidated page.tsx renders every active domain inline now, no
 * per-domain route to link to. The Section-level row above it stays: V1
 * only has "health" active so it never actually renders more than one
 * item today, but it's the real multi-section switch for whenever a
 * second section (Learning, Family, etc.) activates, not "sub tabs" in
 * the sense that was cut.
 */
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

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
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

      <div className="py-6">{children}</div>
    </div>
  );
}
