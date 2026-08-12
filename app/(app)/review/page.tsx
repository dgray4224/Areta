import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { ReviewTabs } from "./ReviewTabs";
import { Insights } from "./Insights";
import { Trends } from "./Trends";

/**
 * Collapsed from 6 query-param sub-tabs plus a separate /review/brief
 * route down to 2 (2026-08-12 redesign) — "Insights" (the redesigned
 * narrative brief, or the pre-brief metrics+interview state, rendered
 * inline with no redirect) and "Trends" (every chart-forward number).
 * Plan Recap dropped entirely (the Plan tab already covers adherence);
 * the weekly-outcomes check-in folded into Insights instead of its own
 * tab. Matches areta-mobile's app/(tabs)/review/index.tsx split exactly.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Weekly review</h1>
      </div>

      <ReviewTabs />

      {tab === "trends" ? <Trends userId={user.id} /> : <Insights userId={user.id} />}
    </div>
  );
}
