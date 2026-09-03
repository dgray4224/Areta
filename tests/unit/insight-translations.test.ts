import { describe, expect, it } from "vitest";
import { computeAvailability, type AvailabilityDayRow } from "@/domains/insights/availability";
import { generateTranslations } from "@/domains/insights/generators/translations";

const TODAY = "2026-09-03";

function stepDays(count: number, stepsPerDay: number): { day: string; stepsTotal: number }[] {
  const days: { day: string; stepsTotal: number }[] = [];
  const base = new Date("2024-01-01T00:00:00Z");
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    days.push({ day: d.toISOString().slice(0, 10), stepsTotal: stepsPerDay });
  }
  return days;
}

function availabilityFor(days: { day: string; stepsTotal: number }[]) {
  const rows: AvailabilityDayRow[] = days.map((d) => ({
    day: d.day,
    hasSteps: d.stepsTotal > 0,
    hasSleep: false,
    hasWorkout: false,
    hasWeight: false,
    hasHeartRate: false,
  }));
  return computeAvailability({ rows, nutritionDays: [], taskDays: [], today: TODAY });
}

describe("generateTranslations", () => {
  it("picks the largest landmark the lifetime total has crossed", () => {
    // 600 days x 10,000 steps = 6,000,000 steps ≈ 4,572 km — past San
    // Francisco→New York (4,130), short of the Great Wall (6,300).
    const days = stepDays(600, 10_000);
    const out = generateTranslations({ allTimeSummaries: days, availability: availabilityFor(days), units: null });
    expect(out).toHaveLength(1);
    expect(out[0].facts.landmarkKey).toBe("us_coast_to_coast");
    expect(out[0].dedupeKey).toBe("translation:distance:us_coast_to_coast");
    expect(out[0].headline).toContain("km");
    expect(out[0].type).toBe("translation");
  });

  it("phrases distance in miles for imperial users", () => {
    const days = stepDays(600, 10_000);
    const out = generateTranslations({ allTimeSummaries: days, availability: availabilityFor(days), units: "imperial" });
    expect(out[0].headline).toContain("miles");
    expect(out[0].facts.totalMiles).toBeGreaterThan(2500);
  });

  it("says how many times over when the landmark is dwarfed", () => {
    // 3.15M steps ≈ 2,400 km — past Italy (1,185) twice, short of
    // London→Moscow (2,900), so Italy is picked at ~2.0x.
    const days = stepDays(350, 9_000);
    const out = generateTranslations({ allTimeSummaries: days, availability: availabilityFor(days), units: null });
    expect(out[0].facts.landmarkKey).toBe("italy");
    expect(out[0].headline).toContain("times over");
  });

  it("stays silent without usable step availability", () => {
    const days = stepDays(5, 20_000); // big total, five days of data
    const out = generateTranslations({ allTimeSummaries: days, availability: availabilityFor(days), units: null });
    expect(out).toHaveLength(0);
  });

  it("stays silent below the first landmark", () => {
    const days = stepDays(40, 1_000); // 40k steps ≈ 30 km < a marathon
    const out = generateTranslations({ allTimeSummaries: days, availability: availabilityFor(days), units: null });
    expect(out).toHaveLength(0);
  });
});

describe("computeAvailability", () => {
  it("computes per-domain day counts, recency, and usability floors", () => {
    const rows: AvailabilityDayRow[] = [];
    const base = new Date("2026-08-20T00:00:00Z"); // within 30d of TODAY
    for (let i = 0; i < 12; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() - i * 3); // every 3rd day, some outside 30d
      rows.push({
        day: d.toISOString().slice(0, 10),
        hasSteps: true,
        hasSleep: i < 4,
        hasWorkout: i % 2 === 0,
        hasWeight: false,
        hasHeartRate: false,
      });
    }
    const a = computeAvailability({ rows, nutritionDays: ["2026-09-01", "2026-09-02"], taskDays: [], today: TODAY });
    expect(a.steps.days).toBe(12);
    expect(a.steps.usable).toBe(false); // floor is 30
    expect(a.sleep.days).toBe(4);
    expect(a.workouts.days).toBe(6);
    expect(a.weight.days).toBe(0);
    expect(a.weight.usable).toBe(false);
    expect(a.nutrition.days).toBe(2);
    expect(a.nutrition.recentDays).toBe(2);
    expect(a.steps.recentDays).toBeGreaterThan(0);
    expect(a.steps.firstDay! < a.steps.lastDay!).toBe(true);
  });
});
