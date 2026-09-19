import { describe, expect, it } from "vitest";
import { findConcerns, renderReport, type UsageReport } from "@/domains/observability/weekly-report";

const NOW = new Date("2026-09-21T14:00:00Z");

function isoDaysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

/** A healthy week: every job recent, the loop being used. */
function healthyReport(overrides: Partial<UsageReport> = {}): UsageReport {
  return {
    window: { since: isoDaysAgo(7), until: NOW.toISOString() },
    users: { total: 14, onboarded: 13, stalled_in_onboarding: 1, new_this_week: 2, onboarded_this_week: 2 },
    engagement: { active_this_week: 9, active_prior_week: 10, retained: 8 },
    loop: {
      briefs_generated: 13,
      briefs_approved: 7,
      meals_planned: 60,
      meals_ticked: 41,
      workouts_planned: 40,
      workouts_completed: 22,
      meal_swaps: 3,
      offplan_logs: 12,
      quick_estimates: 5,
    },
    data_in: { users_syncing: 9, health_rows: 5000, push_tokens: 11 },
    system: {
      ai_runs: 13,
      ai_failures: 0,
      insights_created: 6,
      last_brief_success: isoDaysAgo(1),
      last_insight_created: isoDaysAgo(1),
      last_workout_plan_created: isoDaysAgo(2),
      last_meal_plan_created: isoDaysAgo(1),
    },
    ...overrides,
  };
}

describe("findConcerns", () => {
  it("says nothing when everything is fresh and used", () => {
    expect(findConcerns(healthyReport(), NOW)).toEqual([]);
  });

  it("catches the four-week brief outage this whole report exists for", () => {
    const report = healthyReport();
    report.system.last_brief_success = isoDaysAgo(27);
    const concerns = findConcerns(report, NOW);
    expect(concerns.map((c) => c.label)).toContain("Weekly brief");
    expect(concerns.find((c) => c.label === "Weekly brief")?.detail).toContain("27 days ago");
  });

  it("catches a job that has never produced anything", () => {
    const report = healthyReport();
    report.system.last_insight_created = null;
    expect(findConcerns(report, NOW).find((c) => c.label === "Insight engine")?.detail).toBe(
      "has never produced anything"
    );
  });

  it("flags a plan nobody touched, which is the product not landing", () => {
    const report = healthyReport();
    report.loop.workouts_completed = 0;
    const concerns = findConcerns(report, NOW);
    expect(concerns.find((c) => c.label === "Workouts")?.detail).toContain("40 planned, none marked done");
  });

  it("does not flag zero completions when nothing was planned", () => {
    const report = healthyReport();
    report.loop.workouts_planned = 0;
    report.loop.workouts_completed = 0;
    report.loop.meals_planned = 0;
    report.loop.meals_ticked = 0;
    expect(findConcerns(report, NOW).map((c) => c.label)).not.toContain("Workouts");
  });

  it("flags a week where every AI run failed", () => {
    const report = healthyReport();
    report.system.ai_runs = 13;
    report.system.ai_failures = 13;
    expect(findConcerns(report, NOW).map((c) => c.label)).toContain("AI runs");
  });

  it("flags total silence from users", () => {
    const report = healthyReport();
    report.engagement.active_this_week = 0;
    expect(findConcerns(report, NOW).map((c) => c.label)).toContain("Engagement");
  });
});

describe("renderReport", () => {
  it("leads the subject with all clear when nothing is wrong", () => {
    expect(renderReport(healthyReport(), NOW).subject).toBe("Areta weekly: all clear");
  });

  it("counts the problems in the subject so the inbox line is the summary", () => {
    const report = healthyReport();
    report.system.last_brief_success = isoDaysAgo(27);
    report.engagement.active_this_week = 0;
    expect(renderReport(report, NOW).subject).toBe("Areta weekly: 2 things to look at");
  });

  it("uses the singular for one problem", () => {
    const report = healthyReport();
    report.engagement.active_this_week = 0;
    expect(renderReport(report, NOW).subject).toBe("Areta weekly: 1 thing to look at");
  });

  it("shows adherence as a percentage next to the raw count", () => {
    const body = renderReport(healthyReport(), NOW).body;
    expect(body).toContain("41 (68%)");
    expect(body).toContain("22 (55%)");
  });

  it("writes n/a rather than a divide-by-zero when nothing was planned", () => {
    const report = healthyReport();
    report.loop.meals_planned = 0;
    report.loop.meals_ticked = 0;
    expect(renderReport(report, NOW).body).toMatch(/Meals ticked\s+0 \(n\/a\)/);
  });

  it("puts every section in the body", () => {
    const body = renderReport(healthyReport(), NOW).body;
    for (const heading of ["NEEDS ATTENTION", "PEOPLE", "ENGAGEMENT", "THE LOOP", "DATA COMING IN", "SYSTEM"]) {
      expect(body).toContain(heading);
    }
  });
});
