import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getDashboardData } from "./data";
import { TaskItem } from "./TaskItem";
import { AddTaskForm } from "./AddTaskForm";

const QUICK_LOG_LINKS = [
  { href: "/log/weight", label: "Weight" },
  { href: "/log/sleep", label: "Sleep" },
  { href: "/log/nutrition", label: "Food" },
  { href: "/log/recovery", label: "Recovery" },
  { href: "/log/learning", label: "Learning" },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  if (!data.profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const requiredTasks = data.todayTasks.filter((t) => t.isRequired);
  const optionalTasks = data.todayTasks.filter((t) => !t.isRequired);
  const topPriorities = data.goals.slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <p className="text-sm text-neutral-500">Today · {data.today}</p>
        <h1 className="text-2xl font-semibold">{data.profile.fullName ?? "there"}</h1>
      </div>

      {data.currentPhase ? (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-500">Current phase</p>
          <p className="text-lg font-medium">{data.currentPhase.name}</p>
          {data.currentPhase.mission ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {data.currentPhase.mission}
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No active phase yet"
          description="Complete onboarding to generate your first phase."
        />
      )}

      <section className="rounded-lg border border-neutral-900 bg-neutral-900 p-4 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
        <p className="text-xs uppercase tracking-wide opacity-70">Next action</p>
        <p className="mt-1 text-lg font-medium">
          {data.recommendedNextAction ?? "Nothing planned yet — add a task below or log today's data."}
        </p>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Progress</h2>
          <span className="text-sm text-neutral-500">
            {data.taskProgress.completed} of {data.taskProgress.total} tasks
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-neutral-900 transition-all dark:bg-neutral-100"
            style={{
              width:
                data.taskProgress.total > 0
                  ? `${Math.round((data.taskProgress.completed / data.taskProgress.total) * 100)}%`
                  : "0%",
            }}
          />
        </div>
      </section>

      <section className="space-y-3">
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
              className="rounded-md border border-neutral-200 px-3 py-2 text-center text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-500 sm:grid-cols-5">
          <div>Weight: {data.logsToday.weightLogged ? "logged" : "not yet"}</div>
          <div>Sleep: {data.logsToday.sleepLogged ? "logged" : "not yet"}</div>
          <div>Food entries: {data.logsToday.nutritionEntries}</div>
          <div>Recovery: {data.logsToday.recoveryLogged ? "logged" : "not yet"}</div>
          <div>Study: {data.logsToday.learningMinutes} min</div>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Planned meals</h2>
        <EmptyState
          title="Meal planning arrives in Phase 3"
          description="For now, log what you eat with Quick log → Food."
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Upcoming events</h2>
        <EmptyState
          title="Calendar integration arrives later"
          description="Appointments and scheduling aren't built yet."
        />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Active domains</h2>
        {data.domains.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.domains.map((d) => (
              <span
                key={d.key}
                className="rounded-full bg-neutral-200 px-3 py-1 text-xs dark:bg-neutral-800"
              >
                {d.label}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState title="No active domains" />
        )}
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

      <section className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        Weekly review and AI-generated plans arrive in later phases. For now, this is your daily
        working screen.
      </section>
    </div>
  );
}
