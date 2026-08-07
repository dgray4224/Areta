import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientMealMonthCalendar } from "@/domains/trainer/service";
import { getRecipesForTrainer } from "@/domains/trainermealprogram/service";
import { currentMonthString, shiftMonth, monthBounds, monthLabel, gridBounds } from "./date-utils";
import { CalendarMonthView } from "./CalendarMonthView";

export default async function ClientMealCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { clientId } = await params;
  const { month: monthParam } = await searchParams;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthString();

  const { start: monthStart } = monthBounds(month);
  const { gridStart, gridEnd } = gridBounds(month);

  const [result, recipes] = await Promise.all([
    getClientMealMonthCalendar(clientId, gridStart, gridEnd),
    getRecipesForTrainer(),
  ]);
  if (!result.ok) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/trainer/clients/${clientId}/nutrition`} className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        <div className="flex gap-2">
          <Link
            href={`/trainer/clients/${clientId}/nutrition/calendar?month=${shiftMonth(month, -1)}`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
          >
            ← Prev
          </Link>
          <Link
            href={`/trainer/clients/${clientId}/nutrition/calendar?month=${currentMonthString()}`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
          >
            Today
          </Link>
          <Link
            href={`/trainer/clients/${clientId}/nutrition/calendar?month=${shiftMonth(month, 1)}`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
          >
            Next →
          </Link>
        </div>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Click a day to edit it. Past days are read-only.
      </p>

      <CalendarMonthView clientId={clientId} monthStart={monthStart} days={result.data} recipes={recipes} />
    </div>
  );
}
