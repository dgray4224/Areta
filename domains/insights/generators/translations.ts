import type { DataAvailability } from "../availability";
import type { InsightCandidate } from "../types";
import { sampleSizeScore, scoreCandidate } from "../scoring";

/**
 * Translation insights (2026-09-03) — lifetime totals restated as
 * something a person can picture. "5,000,000 steps" is a usage counter;
 * "you've walked San Francisco to New York" is a fact about a life.
 *
 * Deterministic, no statistics: the only judgment is which landmark to
 * pick, and the ladder settles that. Each rung has its own dedupe key,
 * so a user re-earns a fresh card every time their total crosses the
 * next landmark — progression is built into the dedupe scheme rather
 * than being a cooldown hack.
 *
 * Availability-gated: fires only when steps are genuinely tracked
 * (availability.steps.usable), so a user with three days of data never
 * gets a "lifetime" claim built on noise.
 */

/** Average adult step length. The point is a picturable order of
 * magnitude, not surveying precision — the headline says "about". */
const KM_PER_STEP = 0.000762;

/** Ascending. Distances are the commonly cited figures for each route
 * or feature — recognizable beats precise, and every headline hedges
 * with "about". Each key is part of the dedupe identity: renaming one
 * re-fires it for everyone, so edit labels, not keys. */
const LANDMARKS: { key: string; km: number; label: string }[] = [
  { key: "marathon", km: 42.2, label: "a marathon" },
  { key: "english_channel", km: 150, label: "the English Channel and back, twice" },
  { key: "london_paris", km: 344, label: "London to Paris" },
  { key: "pacific_coast_highway", km: 1055, label: "the whole Pacific Coast Highway" },
  { key: "italy", km: 1185, label: "the length of Italy" },
  { key: "london_moscow", km: 2900, label: "London to Moscow" },
  { key: "us_coast_to_coast", km: 4130, label: "San Francisco to New York" },
  { key: "great_wall", km: 6300, label: "the length of the Great Wall of China" },
  { key: "earth_circumference", km: 40075, label: "all the way around the Earth" },
];

const KM_PER_MILE = 1.609344;

export function generateTranslations(input: {
  /** Lifetime (retention-capped) daily step totals. */
  allTimeSummaries: { day: string; stepsTotal: number }[];
  availability: DataAvailability;
  /** profiles.units — "imperial" phrases distance in miles. */
  units: string | null;
}): InsightCandidate[] {
  if (!input.availability.steps.usable) return [];

  const totalSteps = input.allTimeSummaries.reduce((sum, d) => sum + d.stepsTotal, 0);
  const totalKm = totalSteps * KM_PER_STEP;

  let landmark: (typeof LANDMARKS)[number] | null = null;
  for (const l of LANDMARKS) {
    if (totalKm >= l.km) landmark = l;
  }
  if (!landmark) return [];

  const times = totalKm / landmark.km;
  const stepDays = input.availability.steps.days;

  const imperial = input.units === "imperial";
  const distance = imperial
    ? `${Math.round(totalKm / KM_PER_MILE).toLocaleString("en-US")} miles`
    : `${Math.round(totalKm).toLocaleString("en-US")} km`;

  const timesPhrase =
    times >= 2 ? ` — ${times >= 10 ? Math.round(times) : Math.round(times * 10) / 10} times over` : "";
  const headline = `Your steps add up to about ${distance}. That's ${landmark.label}${timesPhrase}.`;

  const components = {
    // The comparison IS the effect; a bigger landmark is a bigger fact.
    effectSize: Math.min(1, 0.5 + LANDMARKS.indexOf(landmark) * 0.07),
    sampleSize: sampleSizeScore(stepDays),
    // Nothing to do with it but feel good — that's fine, and honest.
    actionability: 0.1,
    goalRelevance: 0,
    // Nobody has an intuition for their lifetime step total in miles.
    surprise: 0.8,
  };
  const scored = scoreCandidate(components);

  const first = input.allTimeSummaries[0]?.day ?? null;
  const last = input.allTimeSummaries[input.allTimeSummaries.length - 1]?.day ?? null;

  return [
    {
      type: "translation",
      grain: "lifetime",
      periodStart: first,
      periodEnd: last,
      facts: {
        kind: "distance",
        totalSteps,
        totalKm: Math.round(totalKm),
        totalMiles: Math.round(totalKm / KM_PER_MILE),
        landmarkKey: landmark.key,
        landmarkLabel: landmark.label,
        times: Math.round(times * 10) / 10,
      },
      headline,
      score: scored.score,
      dedupeKey: `translation:distance:${landmark.key}`,
      tier: 0,
      generatorKey: "translation_distance",
      generatorVersion: 1,
      scoreComponents: scored.components,
    },
  ];
}
