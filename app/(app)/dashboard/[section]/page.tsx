import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { Card } from "@/platform/ui/Card";
import { LinkButton } from "@/platform/ui/Button";
import { getWeekDates, formatShortDate, DAY_NAMES } from "@/platform/ui/week-dates";
import { getDashboardData } from "../data";
import { getDashboardTrends } from "../trends-data";
import { TaskItem } from "../TaskItem";
import { AddTaskForm } from "../AddTaskForm";
import { ScheduleTimeline } from "../ScheduleTimeline";
import { TaskCompletionChart } from "@/platform/ui/charts/TaskCompletionChart";
import { getActivePrompt } from "@/domains/prompts/service";
import { PromptCard } from "./PromptCard";

const QUICK_LOG_LINKS = [
  { href: "/log/weight", label: "Weight" },
  { href: "/log/sleep", label: "Sleep" },
  { href: "/log/nutrition", label: "Food" },
  { href: "/log/exercise", label: "Exercise" },
  { href: "/log/learning", label: "Learning" },
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DashboardSectionSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const viewDate = date && ISO_DATE.test(date) ? date : undefined;

  const user = await requireUser();
  const data = await getDashboardData(user.id, viewDate);
  const trends = await getDashboardTrends(user.id);
  const activePrompt = await getActivePrompt(user.id);

  const requiredTasks = data.todayTasks.filter((t) => t.isRequired);
  const optionalTasks = data.todayTasks.filter((t) => !t.isRequired);
  const topPriorities = data.goals.slice(0, 3);
  const weekDates = getWeekDates(data.today);
  const isViewingToday = data.selectedDate === data.today;
  const calendarEventsForSelectedDate = data.upcomingEvents.filter((e) => e.startsAt.slice(0, 10) === data.selectedDate);

  const nextTask = [...requiredTasks, ...optionalTasks].find((t) => t.status === "planned") ?? null;
  const requiredDoneCount = requiredTasks.filter(
    (t) => t.status === "completed" || t.status === "partially_completed"
  ).length;
  const weightInsight =
    trends.weight.recentDelta !== null ? formatWeightInsight(trends.weight.recentDelta, trends.weight.unit) : null;

  let heroEyebrow: string;
  let heroHeadline: string;
  let heroSubtext: string | null;
  let heroCta: string;
  if (nextTask) {
    heroEyebrow = "Next action";
    heroHeadline = nextTask.title;
    heroSubtext = nextTask.goalOutcome ? `Moves you toward: ${nextTask.goalOutcome}` : weightInsight;
    heroCta = "Begin";
  } else if (requiredTasks.length > 0 && requiredDoneCount === requiredTasks.length) {
    heroEyebrow = "Today";
    heroHeadline = `All ${requiredTasks.length} required task${requiredTasks.length === 1 ? "" : "s"} done — nice work.`;
    heroSubtext = weightInsight ?? "Optional tasks and quick logs are still open below.";
    heroCta = "View tasks";
  } else {
    heroEyebrow = "Today";
    heroHeadline = weightInsight ?? "Nothing logged yet today.";
    heroSubtext = weightInsight ? "Add a task below to plan the rest of the day." : "Add a task below, or log your weight, sleep, or food to get started.";
    heroCta = "Add a task";
  }

  const weekLinks = [
    {
      href: "/plan",
      label: "Grocery list",
      status:
        data.thisWeek.groceryItemsRemaining === null
          ? "Not generated yet"
          : `${data.thisWeek.groceryItemsRemaining} items left`,
    },
    {
      href: "/plan",
      label: "Meal plan",
      status: data.thisWeek.hasApprovedMealPlan ? "Active" : "Set up",
    },
    {
      href: "/plan",
      label: "Workout plan",
      status: data.thisWeek.hasApprovedWorkoutPlan ? "Active" : "Set up",
    },
    {
      href: "/plan",
      label: "Prep plan",
      status: data.thisWeek.hasPrepPlan ? "Ready" : "Not built",
    },
  ] as const;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">good {timeOfDayGreeting()}.</p>
          <h1 className="text-2xl font-semibold">{data.profile.fullName ?? "there"}</h1>
          {data.currentPhase ? (
            <p className="mt-0.5 text-xs text-neutral-400">
              {data.currentPhase.name}
              {data.currentPhase.mission ? ` · ${data.currentPhase.mission}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex justify-between xl:max-w-md">
        {DAY_NAMES.map((dayName, i) => {
          const cellDate = weekDates[i];
          const isToday = cellDate === data.today;
          const isSelected = cellDate === data.selectedDate;
          return (
            <Link
              key={dayName}
              href={isToday ? "?" : `?date=${cellDate}`}
              className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition-colors ${
                isSelected
                  ? "bg-brand-fill text-brand-ink"
                  : isToday
                    ? "border-2 border-brand"
                    : "hover:bg-black/[0.03] dark:hover:bg-white/5"
              }`}
            >
              <span
                className={`text-[10px] font-semibold ${isSelected ? "text-brand-ink/70" : "text-neutral-400"}`}
              >
                {dayName[0]}{dayName[1]}
              </span>
              <span className="text-sm font-bold tabular-nums">{formatShortDate(cellDate).split(" ")[1]}</span>
            </Link>
          );
        })}
      </div>

      {!isViewingToday ? (
        <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 text-sm dark:bg-white/5">
          <span className="text-neutral-500">
            Viewing {formatShortDate(data.selectedDate)}
          </span>
          <Link href="?" className="font-medium text-brand hover:underline">
            Jump to today
          </Link>
        </div>
      ) : null}

      {/* Two columns from xl up — main (hero + schedule + longer-form
       * content) and a narrower side rail (tasks, week status, trends).
       * Below xl this just stacks in document order, same as before. */}
      <div className="xl:grid xl:grid-cols-[1fr_360px] xl:items-start xl:gap-8">
        <div className="space-y-6">
          <Card tone="hero">
            <p className="text-xs font-medium uppercase tracking-wide text-white/60">{heroEyebrow}</p>
            <p className="mt-2 text-xl font-bold leading-snug">{heroHeadline}</p>
            {heroSubtext ? <p className="mt-1.5 text-sm text-white/60">{heroSubtext}</p> : null}
            <LinkButton href="#tasks" variant="onHero" className="mt-4">
              {heroCta}
            </LinkButton>
          </Card>

          {activePrompt ? (
            <PromptCard
              userId={user.id}
              triggerId={activePrompt.triggerId}
              question={activePrompt.question}
            />
          ) : null}

          <section>
            <h2 className="text-sm font-medium text-neutral-500">
              {isViewingToday ? "Today's schedule" : "Schedule"}
            </h2>
            <div className="mt-2">
              <ScheduleTimeline
                date={data.selectedDate}
                calendarEvents={calendarEventsForSelectedDate}
                meals={data.plannedMealsToday}
                workout={data.todaysWorkout}
                customEvents={data.timelineEvents}
              />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-medium text-neutral-500">Top priorities</h2>
            {topPriorities.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {topPriorities.map((g) => (
                  <li key={g.id}>
                    {g.outcome}
                    {g.targetDate ? ` — by ${g.targetDate}` : ""}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState title="No goals yet" />
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-neutral-500">This week&apos;s outcomes</h2>
            {data.weeklyOutcomes.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {data.weeklyOutcomes.map((w, i) => (
                  <li key={i}>{w.outcomeText}</li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No weekly outcomes yet" />
            )}
          </section>
        </div>

        <div className="mt-6 space-y-6 xl:mt-0">
          <section>
            <h2 className="text-sm font-medium text-neutral-500">This week</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {weekLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  <Card tone="surface" className="hover:bg-black/[0.02] dark:hover:bg-white/5">
                    <p className="font-medium">{link.label}</p>
                    <p className="text-xs text-neutral-500">{link.status}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          <section id="tasks" className="space-y-3 scroll-mt-4">
            <h2 className="text-sm font-medium text-neutral-500">Required tasks</h2>
            {requiredTasks.length > 0 ? (
              <div className="space-y-2">
                {requiredTasks.map((task) => (
                  <TaskItem key={task.id} userId={user.id} task={task} />
                ))}
              </div>
            ) : (
              <EmptyState title="No required tasks for today" />
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-500">Optional tasks</h2>
            {optionalTasks.length > 0 ? (
              <div className="space-y-2">
                {optionalTasks.map((task) => (
                  <TaskItem key={task.id} userId={user.id} task={task} />
                ))}
              </div>
            ) : (
              <EmptyState title="No optional tasks for today" />
            )}
            <AddTaskForm userId={user.id} date={data.selectedDate} />
          </section>

          <section>
            <h2 className="text-sm font-medium text-neutral-500">Quick log</h2>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {QUICK_LOG_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl border border-neutral-200 bg-card px-3 py-2 text-center text-sm hover:bg-black/[0.02] dark:border-neutral-800 dark:hover:bg-white/5"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500">
              <div>Weight: {data.logsToday.weightLogged ? "logged" : "not yet"}</div>
              <div>Sleep: {data.logsToday.sleepLogged ? "logged" : "not yet"}</div>
              <div>Food entries: {data.logsToday.nutritionEntries}</div>
              <div>Study: {data.logsToday.learningMinutes} min</div>
            </dl>
          </section>

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
            <p className="text-xs uppercase tracking-wide text-neutral-500">This month</p>
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

      <section className="rounded-2xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        Tap a pillar above for a closer look at its trends and history.
      </section>
    </div>
  );
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatWeightInsight(delta: number, unit: string): string {
  if (delta === 0) return `Weight steady over the last 7 days.`;
  const direction = delta < 0 ? "Down" : "Up";
  return `${direction} ${Math.abs(delta)} ${unit} over the last 7 days.`;
}
