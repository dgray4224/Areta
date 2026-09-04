import { describe, expect, it } from "vitest";
import { computeMonthPacing, daysInMonth, shiftMonth, type MonthPacingRow } from "@/domains/review/month-pacing";

function day(month: string, d: number): string {
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** Fill a whole month at a constant daily rate. */
function fillMonth(month: string, steps: number, extra: Partial<MonthPacingRow> = {}): MonthPacingRow[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: day(month, i + 1),
    steps_total: steps,
    workout_count: 0,
    workout_total_minutes: 0,
    sleep_logged: false,
    sleep_total_duration_minutes: null,
    ...extra,
  }));
}

function metric(result: ReturnType<typeof computeMonthPacing>, key: string) {
  const m = result.metrics.find((x) => x.key === key);
  if (!m) throw new Error(`missing metric ${key}`);
  return m;
}

describe("computeMonthPacing", () => {
  it("compares the month to date against the same days of the trailing months, not their full totals", () => {
    const rows = [
      ...fillMonth("2026-06", 8000),
      ...fillMonth("2026-07", 8000),
      ...fillMonth("2026-08", 8000),
      ...Array.from({ length: 4 }, (_, i) => ({ ...fillMonth("2026-09", 10000)[0], day: day("2026-09", i + 1) })),
    ];
    const result = computeMonthPacing({ rows, nutritionDays: [], month: "2026-09", today: "2026-09-04" });
    expect(result.daysElapsed).toBe(4);
    expect(result.daysInMonth).toBe(30);
    expect(result.complete).toBe(false);
    expect(result.lastMonthLabel).toBe("August");

    const steps = metric(result, "steps");
    expect(steps.toDate).toBe(40_000);
    expect(steps.sameDayTrailing).toBe(32_000);
    expect(steps.deltaPercent).toBe(25);
    expect(steps.direction).toBe("ahead");
    expect(steps.projected).toBe(300_000);
    expect(steps.lastMonthFull).toBe(248_000);
    expect(steps.usable).toBe(true);
  });

  it("uses the same month last year as a second baseline", () => {
    const rows = [...fillMonth("2025-09", 6000), ...fillMonth("2026-08", 8000), ...fillMonth("2026-09", 7000).slice(0, 10)];
    const steps = metric(computeMonthPacing({ rows, nutritionDays: [], month: "2026-09", today: "2026-09-10" }), "steps");
    expect(steps.sameDayLastYear).toBe(60_000);
    expect(steps.sameDayTrailing).toBe(80_000);
  });

  it("averages only the baseline months that have data", () => {
    const rows = [...fillMonth("2026-08", 9000), ...fillMonth("2026-09", 9000).slice(0, 5)];
    const steps = metric(computeMonthPacing({ rows, nutritionDays: [], month: "2026-09", today: "2026-09-05" }), "steps");
    // June and July are absent; the baseline is August alone, not August / 3.
    expect(steps.sameDayTrailing).toBe(45_000);
    expect(steps.direction).toBe("even");
  });

  it("reports a metric with no baseline as unusable rather than infinitely ahead", () => {
    const rows = fillMonth("2026-09", 9000).slice(0, 5);
    const steps = metric(computeMonthPacing({ rows, nutritionDays: [], month: "2026-09", today: "2026-09-05" }), "steps");
    expect(steps.usable).toBe(false);
    expect(steps.deltaPercent).toBeNull();
    expect(steps.direction).toBeNull();
  });

  it("projects averages to themselves and totals to the full month", () => {
    const sleepRows = (month: string, hours: number, days: number) =>
      fillMonth(month, 0, { sleep_logged: true, sleep_total_duration_minutes: hours * 60 }).slice(0, days);
    const rows = [...sleepRows("2026-08", 7, 31), ...sleepRows("2026-09", 7.5, 6)];
    const result = computeMonthPacing({ rows, nutritionDays: [], month: "2026-09", today: "2026-09-06" });
    const sleep = metric(result, "sleepHours");
    expect(sleep.kind).toBe("average");
    expect(sleep.toDate).toBe(7.5);
    expect(sleep.projected).toBe(7.5);
    expect(sleep.sameDayTrailing).toBe(7);
    expect(sleep.direction).toBe("ahead");
    // Steps had nothing logged, so they are absent rather than zero-vs-zero.
    expect(metric(result, "steps").usable).toBe(false);
  });

  it("counts food-logged days from the nutrition day list", () => {
    const rows = [...fillMonth("2026-08", 5000), ...fillMonth("2026-09", 5000).slice(0, 10)];
    const nutritionDays = [
      ...Array.from({ length: 20 }, (_, i) => day("2026-08", i + 1)),
      ...Array.from({ length: 9 }, (_, i) => day("2026-09", i + 1)),
    ];
    const food = metric(computeMonthPacing({ rows, nutritionDays, month: "2026-09", today: "2026-09-10" }), "foodDays");
    expect(food.toDate).toBe(9);
    // First 10 days of August: all 10 logged.
    expect(food.sameDayTrailing).toBe(10);
    expect(food.lastMonthFull).toBe(20);
  });

  it("treats a past month as complete with every day elapsed", () => {
    const rows = [...fillMonth("2026-07", 8000), ...fillMonth("2026-08", 9000)];
    const result = computeMonthPacing({ rows, nutritionDays: [], month: "2026-08", today: "2026-09-04" });
    expect(result.complete).toBe(true);
    expect(result.daysElapsed).toBe(31);
    expect(metric(result, "steps").toDate).toBe(279_000);
    expect(metric(result, "steps").projected).toBe(279_000);
  });

  it("month arithmetic crosses year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-01", -13)).toBe("2024-12");
    expect(daysInMonth("2024-02")).toBe(29);
  });
});
