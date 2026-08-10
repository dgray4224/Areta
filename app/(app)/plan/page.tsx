import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { EmptyState } from "@/platform/ui/EmptyState";
import { Card } from "@/platform/ui/Card";
import { LinkButton } from "@/platform/ui/Button";
import { getWeekDates, formatShortDate, DAY_NAMES } from "@/platform/ui/week-dates";
import { getMealPlanForWeek } from "@/domains/mealplan/service";
import { getWorkoutPlanForWeek } from "@/domains/workoutplan/service";
import { getGroceryListForWeek } from "@/domains/grocery/service";
import { getPrepPlanForWeek } from "@/domains/prep/service";
import { getRecipesByIds } from "@/domains/recipes/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { getMotivationQuote } from "@/domains/motivation/quotes";
import type { WeeklyBrief } from "@/domains/review/brief-schema";
import { WeekPicker } from "./WeekPicker";
import { navTabClass } from "../nav-links";

const TABS = [
  { view: "week", label: "Week" },
  { view: "month", label: "Month" },
  { view: "year", label: "Year" },
] as const;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; week?: string }>;
}) {
  const user = await requireUser();
  const { view: rawView, week: requestedWeek } = await searchParams;
  const view = rawView === "month" || rawView === "year" ? rawView : "week";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Plan</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          What your week (and eventually month, year) looks like — meals, workouts,
          groceries, and prep, all in one place.
        </p>
      </div>

      <nav className="flex gap-1 border-b border-black/5 dark:border-white/5">
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={`/plan?view=${tab.view}`}
            className={`border-b-2 px-3 py-2 text-sm ${navTabClass(view === tab.view)}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {view === "week" ? (
        <WeekView userId={user.id} requestedWeek={requestedWeek} />
      ) : (
        <EmptyState
          title={`${view === "month" ? "Month" : "Year"} view — not built yet`}
          description="Weekly planning is fully built. Month and Year rollups (goal progress and adherence trends across a longer horizon) are the next thing on the roadmap."
        />
      )}
    </div>
  );
}

async function WeekView({ userId, requestedWeek }: { userId: string; requestedWeek?: string }) {
  const supabase = await createClient();

  const { data: recentMealPlans } = await supabase
    .from("meal_plans")
    .select("week_start")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(30);

  const weekOptions = [...new Set((recentMealPlans ?? []).map((r) => r.week_start))];
  const weekStart = requestedWeek ?? weekOptions[0] ?? todayDateString();

  const [mealPlan, workoutPlan, groceryItems, prepPlan, { data: latestReview }, { data: phases }, { data: goals }, { data: weeklyOutcomes }] =
    await Promise.all([
      getMealPlanForWeek(userId, weekStart),
      getWorkoutPlanForWeek(userId, weekStart),
      getGroceryListForWeek(userId, weekStart),
      getPrepPlanForWeek(userId, weekStart),
      supabase
        .from("weekly_reviews")
        .select("brief")
        .eq("user_id", userId)
        .not("brief", "is", null)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("phases").select("name, mission").eq("user_id", userId).eq("is_current", true).limit(1),
      supabase
        .from("goals")
        .select("id, outcome, target_date, priority")
        .eq("user_id", userId)
        .order("priority", { ascending: true })
        .limit(3),
      supabase
        .from("weekly_outcomes")
        .select("outcome_text")
        .eq("user_id", userId)
        .eq("status", "proposed"),
    ]);

  const brief = latestReview?.brief as WeeklyBrief | null | undefined;
  const motto = brief ? getMotivationQuote(brief.weeklyMottoId) : null;
  const phaseMission = phases && phases.length > 0 ? phases[0].mission : null;

  const [recipes, exercises] = await Promise.all([
    getRecipesByIds([...new Set((mealPlan?.items ?? []).map((i) => i.recipeId))]),
    getExercisesByIds([...new Set((workoutPlan?.items ?? []).map((i) => i.exerciseId))]),
  ]);

  const weekDates = getWeekDates(weekStart);
  const today = todayDateString();

  return (
    <div className="space-y-6">
      {weekOptions.length > 0 ? (
        <WeekPicker weekStart={weekStart} options={weekOptions} />
      ) : null}

      <div className="max-w-2xl space-y-6">
        <Card tone="hero">
          {motto ? (
            <>
              <p className="text-lg italic leading-snug">&ldquo;{motto.quote}&rdquo;</p>
              <p className="mt-2 text-xs text-white/60">— {motto.author}</p>
            </>
          ) : phaseMission ? (
            <p className="text-sm">This week: {phaseMission}</p>
          ) : (
            <p className="text-sm text-white/70">
              Generate a weekly brief from{" "}
              <Link href="/review" className="underline">
                Review
              </Link>{" "}
              to get a motto for the week.
            </p>
          )}
        </Card>

        <section>
          <h2 className="text-sm font-medium text-neutral-500">This week&apos;s priorities</h2>
          {goals && goals.length > 0 ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {goals.map((g) => (
                <li key={g.id}>
                  {g.outcome}
                  {g.target_date ? ` — by ${g.target_date}` : ""}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No goals yet" />
          )}
          {weeklyOutcomes && weeklyOutcomes.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
              {weeklyOutcomes.map((w, i) => (
                <li key={i}>{w.outcome_text}</li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">This week</h2>
          <div className="flex gap-3 text-xs text-neutral-500">
            <Link href="/plan/meals" className="hover:text-brand">
              Full meal plan
            </Link>
            <Link href="/plan/workouts" className="hover:text-brand">
              Full workout plan
            </Link>
          </div>
        </div>
        {mealPlan || workoutPlan ? (
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {DAY_NAMES.map((dayName, day) => {
              const date = weekDates[day];
              const isToday = date === today;
              const meals = (mealPlan?.items ?? []).filter((i) => i.dayOfWeek === day);
              const workouts = (workoutPlan?.items ?? []).filter((i) => i.dayOfWeek === day);
              return (
                <Card
                  key={day}
                  tone="surface"
                  className={`space-y-3 ${isToday ? "border-2 border-brand" : ""}`}
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      {dayName}
                      {isToday ? " · today" : ""}
                    </p>
                    <p className="text-sm font-semibold">{formatShortDate(date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Workout</p>
                    {workouts.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {workouts.map((w) => (
                          <li key={w.id}>{exercises.get(w.exerciseId)?.name ?? "Unknown"}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-neutral-400">
                        {workoutPlan ? "Rest" : "—"}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">Meals</p>
                    {meals.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs">
                        {meals.map((m) => (
                          <li key={m.id} className="capitalize">
                            {m.mealType}: {recipes.get(m.recipeId)?.name ?? "Unknown"}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-neutral-400">—</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No plan for this week yet"
            action={
              <Link href="/plan/setup" className="text-sm text-brand underline">
                Set up
              </Link>
            }
          />
        )}
      </section>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href="/plan/grocery">
          <Card tone="surface" className="hover:bg-black/[0.02] dark:hover:bg-white/5">
            <p className="text-sm font-medium">Grocery list</p>
            <p className="mt-1 text-xs text-neutral-500">
              {groceryItems.length > 0
                ? `${groceryItems.filter((i) => !i.isChecked).length} of ${groceryItems.length} left`
                : "Not generated yet"}
            </p>
          </Card>
        </Link>
        <Link href="/plan/prep">
          <Card tone="surface" className="hover:bg-black/[0.02] dark:hover:bg-white/5">
            <p className="text-sm font-medium">Sunday prep</p>
            <p className="mt-1 text-xs text-neutral-500">
              {prepPlan && prepPlan.steps.length > 0
                ? `~${prepPlan.estimatedMinutes ?? "?"} min, ${prepPlan.containerCount ?? "?"} containers`
                : "Not built yet"}
            </p>
          </Card>
        </Link>
      </div>

      <LinkButton href="/plan/setup" variant="secondary">
        Manage / regenerate this week&apos;s plan
      </LinkButton>
    </div>
  );
}
