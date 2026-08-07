import type { MetricType } from "@/platform/health/metrics";

/** The 17 simple point-in-time vitals types added alongside the original 5
 * HealthKit types (weight/sleep/steps/heart_rate/workout). None of these
 * roll up into activity_daily_summaries this pass — stored for future
 * features to build on, not surfaced yet (no recompute call, unlike
 * weight/sleep/steps/heart-rate/workout's insert paths).
 *
 * Deliberately not in service.ts: that file is "use server", and a "use
 * server" file may only export async functions — this constant tripped
 * exactly that build-time check (Next.js error "A 'use server' file can
 * only export async functions, found object"), which `next dev` doesn't
 * enforce as strictly as the production build does. */
export const VITAL_QUANTITY_TYPES = [
  "vo2_max",
  "resting_heart_rate",
  "heart_rate_variability",
  "walking_heart_rate_avg",
  "active_energy",
  "basal_energy",
  "distance_walking_running",
  "distance_cycling",
  "body_fat_percentage",
  "lean_body_mass",
  "body_mass_index",
  "height",
  "flights_climbed",
  "walking_speed",
  "walking_steadiness",
  "oxygen_saturation",
  "respiratory_rate",
] as const satisfies readonly MetricType[];

export type VitalQuantityType = (typeof VITAL_QUANTITY_TYPES)[number];
