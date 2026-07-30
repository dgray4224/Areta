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

export default async function DashboardSectionSummaryPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);
  const trends = await getDashboardTrends(user.id);
  const activePrompt = await getActivePrompt(user.id);

  const requiredTasks = data.todayTasks.filter((t) => t.isRequired);
  const optionalTasks = data.todayTasks.filter((t) => !t.isRequired);
  const topPriorities = data.goals.slice(0, 3);
  const weekDates = getWeekDates(data.today);

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
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">good {timeOfDayGreeting()}.</p>
          <h1 className="text-2xl font-semibold">{data.profile.fullName ?? "there"}</h1>
        </div>
      </div>

      <div className="flex justify-between">
        {DAY_NAMES.map((dayName, i) => {
          const date = weekDates[i];
          const isToday = date === data.today;
          return (
            <div
              key={dayName}
              className={`flex flex-col items-center gap-1 rounded-xl px-2.5 py-2 ${
                isToday ? "border-2 border-brand" : ""
              }`}
            >
              <span className="text-[10px] font-semibold text-neutral-400">{dayName[0]}{dayName[1]}</span>
              <span className="text-sm font-bold tabular-nums">{formatShortDate(date).split(" ")[1]}</span>
            </div>
          );
        })}
      </div>

      {data.currentPhase ? (
        <Card tone="surface">
          <p className="text-sm font-medium text-neutral-500">Current phase</p>
          <p className="text-lg font-medium">{data.currentPhase.name}</p>
          {data.currentPhase.mission ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {data.currentPhase.mission}
            </p>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          title="No active phase yet"
          description="Complete onboarding to generate your first phase."
        />
      )}

      <Card tone="hero">
        <p className="text-xs font-medium uppercase tracking-wide text-white/60">Next action</p>
        <p className="mt-2 mb-5 text-xl font-bold leading-snug">
          {data.recommendedNextAction ?? "Nothing planned yet — add a task below or log today's data."}
        </p>
        <LinkButton href="#tasks" variant="onHero">
          Begin
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
        <h2 className="text-sm font-medium text-neutral-500">This week</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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

      <Card tone="surface">
        <h2 className="text-sm font-medium text-neutral-500">Today&apos;s workout</h2>
        {data.todaysWorkout.hasActivePlan ? (
          data.todaysWorkout.exercises.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {data.todaysWorkout.exercises.map((ex, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>{ex.name}</span>
                  <span className="shrink-0 text-neutral-400">
                    {ex.durationMinutes ? `${ex.durationMinutes} min` : `${ex.sets} × ${ex.reps}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Rest day.</p>
          )
        ) : (
          <EmptyState
            title="No active workout plan"
            description="Generate and approve a weekly workout plan to see today's session here."
            action={
              <Link href="/plan" className="text-sm text-brand underline">
                Go to plan
              </Link>
            }
          />
        )}
      </Card>

      <Card tone="surface">
        <h2 className="text-sm font-medium text-neutral-500">Planned meals</h2>
        {data.plannedMealsToday.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm">
            {data.plannedMealsToday.map((meal, i) => (
              <li key={i} className="flex justify-between">
                <span className="capitalize text-neutral-500">{meal.mealType}</span>
                <span>{meal.recipeName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No active meal plan"
            description="Generate and approve a weekly meal plan to see today's meals here."
            action={
              <Link href="/plan" className="text-sm text-brand underline">
                Go to plan
              </Link>
            }
          />
        )}
      </Card>

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
        <AddTaskForm userId={user.id} date={data.today} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Quick log</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
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
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500 sm:grid-cols-5">
          <div>Weight: {data.logsToday.weightLogged ? "logged" : "not yet"}</div>
          <div>Sleep: {data.logsToday.sleepLogged ? "logged" : "not yet"}</div>
          <div>Food entries: {data.logsToday.nutritionEntries}</div>
          <div>Study: {data.logsToday.learningMinutes} min</div>
        </dl>
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

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Upcoming events</h2>
        <EmptyState
          title="Calendar integration arrives later"
          description="Appointments and scheduling aren't built yet."
        />
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
