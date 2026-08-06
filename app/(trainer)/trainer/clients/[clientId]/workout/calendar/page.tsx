import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientMonthCalendar } from "@/domains/trainer/service";
import { getExercisesForTrainer } from "@/domains/trainerprogram/service";
import { currentMonthString, shiftMonth, monthBounds, monthLabel, gridBounds } from "./date-utils";
import { CalendarMonthView } from "./CalendarMonthView";

export default async function ClientCalendarPage({
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

  const [result, exercises] = await Promise.all([
    getClientMonthCalendar(clientId, gridStart, gridEnd),
    getExercisesForTrainer(),
  ]);
  if (!result.ok) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/trainer/clients/${clientId}/workout`} className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        <div className="flex gap-2">
          <Link
            href={`/trainer/clients/${clientId}/workout/calendar?month=${shiftMonth(month, -1)}`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
          >
            ← Prev
          </Link>
          <Link
            href={`/trainer/clients/${clientId}/workout/calendar?month=${currentMonthString()}`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
          >
            Today
          </Link>
          <Link
            href={`/trainer/clients/${clientId}/workout/calendar?month=${shiftMonth(month, 1)}`}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5"
          >
            Next →
          </Link>
        </div>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Click a day to edit it, or drag one day onto another to move it. Past days are read-only.
      </p>

      <CalendarMonthView clientId={clientId} monthStart={monthStart} days={result.data} exercises={exercises} />
    </div>
  );
}
