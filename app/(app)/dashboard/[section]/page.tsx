import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getDashboardData } from "../data";
import { getDashboardTrends } from "../trends-data";
import { ScheduleTimeline } from "../ScheduleTimeline";
import { TaskCompletionChart } from "@/platform/ui/charts/TaskCompletionChart";
import { getActivePrompt } from "@/domains/prompts/service";
import { PromptCard } from "./PromptCard";

/**
 * Dashboard's "Overview" tab — the desktop equivalent of areta-mobile's
 * "At a Glance" screen (app/(tabs)/today/index.tsx's default pane,
 * lib/today-screens/AtAGlance.tsx). Mirrors that screen's actual real
 * content deliberately, not the wider set of sections this page used to
 * carry over from the pre-parity-audit web layout: a greeting, a Goals
 * entry point, and one schedule timeline card is the whole thing on
 * mobile — no day-switching (today only), no separate task list (mobile
 * dropped that concept app-wide; see AtAGlance.tsx's own doc comment),
 * no inline priorities/outcomes/quick-log/week-status grid.
 *
 * Two things web deliberately still carries that have no direct mobile
 * counterpart on this specific screen, per explicit user sign-off
 * ("mobile's structure, web keeps some extras" — 2026-08-10): a
 * lightweight engagement PromptCard, and a read-only progress/trend
 * chart in the side column. "Upcoming events" also stays — it's the
 * deliberate web substitute for mobile's separate Calendar sub-tab
 * (ruled N/A for web in the mobile-vs-web parity audit), not leftover
 * scope.
 */
export default async function DashboardSectionSummaryPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);
  const trends = await getDashboardTrends(user.id);
  const activePrompt = await getActivePrompt(user.id);

  const todaysCalendarEvents = data.upcomingEvents.filter((e) => e.startsAt.slice(0, 10) === data.today);
  const dateLabel = new Date(`${data.today}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6 pb-6 xl:grid xl:grid-cols-[1fr_320px] xl:items-start xl:gap-8 xl:space-y-0">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Hi, {data.profile.fullName ?? "there"}</h1>
            <p className="mt-1 text-sm text-neutral-500">{dateLabel}</p>
          </div>
          <Link
            href="/goals"
            className="shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-black/[0.03] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
          >
            Goals
          </Link>
        </div>

        <Card>
          <ScheduleTimeline
            date={data.today}
            calendarEvents={todaysCalendarEvents}
            meals={data.plannedMealsToday}
            workout={data.todaysWorkout}
            customEvents={data.timelineEvents}
          />
        </Card>
      </div>

      <div className="mt-6 space-y-6 xl:mt-0">
        {activePrompt ? (
          <PromptCard userId={user.id} triggerId={activePrompt.triggerId} question={activePrompt.question} />
        ) : null}

        <section>
          <h2 className="text-sm font-medium text-neutral-500">Upcoming events</h2>
          {data.upcomingEvents.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {data.upcomingEvents.slice(0, 5).map((event) => (
                <li key={`${event.source}-${event.id}`} className="flex items-center justify-between gap-4 text-sm">
                  <span className="truncate">{event.title}</span>
                  <span className="shrink-0 text-neutral-400">
                    {event.allDay
                      ? "All day"
                      : new Date(event.startsAt).toLocaleString(undefined, {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </span>
                </li>
              ))}
            </ul>
          ) : data.hasCalendarConnection ? (
            <EmptyState title="Nothing on your calendar this week" />
          ) : (
            <EmptyState
              title="No calendar connected"
              description="Connect Google, Outlook, or Apple Calendar to see what's coming up."
              action={
                <Link href="/settings/calendar" className="text-sm text-brand underline">
                  Go to settings
                </Link>
              }
            />
          )}
        </section>

        <section className="space-y-4 border-t border-black/5 pt-6 dark:border-white/5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-500">Progress</h2>
              <span className="text-sm text-neutral-500">
                {data.taskProgress.completed} of {data.taskProgress.total} tasks
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-brand-fill transition-all"
                style={{
                  width:
                    data.taskProgress.total > 0
                      ? `${Math.round((data.taskProgress.completed / data.taskProgress.total) * 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-500">Task completion · last 30 days</h2>
            <Card tone="surface">
              <TaskCompletionChart data={trends.tasks} />
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
