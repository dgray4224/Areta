import { getWeeklyOutcomesCheckIn } from "@/domains/weeklyoutcomes/service";
import { OutcomesCheckInList } from "./OutcomesCheckInList";

/**
 * Review tab's "Check-in" sub-tab — server-fetches this week's proposed
 * outcomes, hands them to the client list for the hit/missed mutation.
 * Matches areta-mobile's WeeklyOutcomesCheckIn.tsx.
 */
export async function OutcomesCheckIn({ userId }: { userId: string }) {
  const outcomes = await getWeeklyOutcomesCheckIn(userId);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">This week&apos;s outcomes</h2>
        <p className="mt-1 text-xs text-neutral-500">Set during onboarding, or from the last brief you approved.</p>
      </div>
      <OutcomesCheckInList userId={userId} initialOutcomes={outcomes} />
    </div>
  );
}
