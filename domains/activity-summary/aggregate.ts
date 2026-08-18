import { localHour } from "@/domains/activity-summary/timezone";

export type WorkoutLogRow = { start_date: string; duration_minutes: number; activity_type: string };
export type WeightLogRow = { logged_at: string; weight: number; unit: "lb" | "kg" };
export type StepLogRow = { logged_at: string; count: number };
export type SleepLogRow = { total_duration_minutes: number | null; quality: number | null };
export type HeartRateLogRow = { bpm: number; dedupKey?: string | null };

/** An ambient daily rollup written by the mobile import instead of that
 * day's several hundred background samples (areta-mobile's
 * reduceHeartRateSamples). Keyed by dedup_key prefix because that is the
 * only field the import controls end to end. */
function isAmbientRollup(row: HeartRateLogRow): boolean {
  return (row.dedupKey ?? "").startsWith("daily-avg-heart_rate-");
}

export type ActivityDailySummaryInsert = {
  user_id: string;
  day: string;
  timezone: string;
  workout_count: number;
  workout_total_minutes: number;
  workout_first_start_at: string | null;
  workout_last_start_at: string | null;
  workout_first_start_local_hour: number | null;
  workout_activity_types: string[];
  weight_logged: boolean;
  weight_first_value: number | null;
  weight_last_value: number | null;
  weight_unit: "lb" | "kg" | null;
  weight_last_logged_at: string | null;
  steps_total: number;
  steps_most_active_local_hour: number | null;
  sleep_logged: boolean;
  sleep_total_duration_minutes: number | null;
  sleep_quality: number | null;
  heart_rate_avg_bpm: number | null;
  heart_rate_sample_count: number;
};

/** Pure aggregation (CLAUDE.md §7 Layer 3) -- turns a day's raw log rows
 * across all five HealthKit-backed tables into the one row to upsert into
 * activity_daily_summaries. Mirrors domains/review/metrics.ts's split of
 * pure computation (this file) from I/O (service.ts). */
export function aggregateActivityDailySummary(input: {
  userId: string;
  day: string;
  timezone: string;
  workoutLogs: WorkoutLogRow[];
  weightLogs: WeightLogRow[];
  stepLogs: StepLogRow[];
  sleepLogs: SleepLogRow[];
  heartRateLogs: HeartRateLogRow[];
}): ActivityDailySummaryInsert {
  const { userId, day, timezone, workoutLogs, weightLogs, stepLogs, sleepLogs, heartRateLogs } = input;

  const workoutStarts = [...workoutLogs].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );
  const firstWorkout = workoutStarts[0] ?? null;
  const lastWorkout = workoutStarts[workoutStarts.length - 1] ?? null;
  // Distinct activity types, in chronological first-occurrence order (not
  // alphabetical) -- e.g. a morning run then an evening lift yields
  // ['Running', 'Weightlifting']. workoutStarts is already sorted by
  // start_date, so a Set built from it naturally preserves that order.
  const workoutActivityTypes = [...new Set(workoutStarts.map((w) => w.activity_type))];

  const weightSorted = [...weightLogs].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );
  const firstWeight = weightSorted[0] ?? null;
  const lastWeight = weightSorted[weightSorted.length - 1] ?? null;

  const stepsTotal = stepLogs.reduce((sum, s) => sum + s.count, 0);
  const stepsByHour = new Map<number, number>();
  for (const s of stepLogs) {
    const hour = localHour(new Date(s.logged_at), timezone);
    stepsByHour.set(hour, (stepsByHour.get(hour) ?? 0) + s.count);
  }
  let mostActiveHour: number | null = null;
  let mostActiveHourSteps = -1;
  for (const [hour, total] of stepsByHour) {
    if (total > mostActiveHourSteps) {
      mostActiveHour = hour;
      mostActiveHourSteps = total;
    }
  }

  // Sum durations rather than picking one row -- a day can have more than
  // one sleep_logs entry (e.g. a nap alongside overnight sleep), all
  // sharing the same `date`. Quality is a subjective 1-5 rating, so it's
  // averaged (rounded) rather than summed.
  const sleepTotalMinutes = sleepLogs.reduce((sum, s) => sum + (s.total_duration_minutes ?? 0), 0);
  const qualityValues = sleepLogs.map((s) => s.quality).filter((q): q is number => q != null);
  const avgQuality =
    qualityValues.length > 0 ? Math.round(qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length) : null;

  // Prefer the ambient rollup where one exists. The import keeps
  // workout-period samples at full resolution and collapses the rest, so
  // a day with a workout holds a handful of ~146 bpm rows alongside one
  // ambient row -- averaging them together reads as ~132 bpm against a
  // true ~77. The rollup already IS that day's ambient mean, so it stands
  // alone rather than being averaged with the exercise samples it
  // deliberately excludes.
  const ambientRollups = heartRateLogs.filter(isAmbientRollup);
  const heartRateSource = ambientRollups.length > 0 ? ambientRollups : heartRateLogs;
  const heartRateAvg =
    heartRateSource.length > 0
      ? heartRateSource.reduce((sum, h) => sum + Number(h.bpm), 0) / heartRateSource.length
      : null;

  return {
    user_id: userId,
    day,
    timezone,
    workout_count: workoutLogs.length,
    workout_total_minutes: workoutLogs.reduce((sum, w) => sum + w.duration_minutes, 0),
    workout_first_start_at: firstWorkout ? new Date(firstWorkout.start_date).toISOString() : null,
    workout_last_start_at: lastWorkout ? new Date(lastWorkout.start_date).toISOString() : null,
    workout_first_start_local_hour: firstWorkout ? localHour(new Date(firstWorkout.start_date), timezone) : null,
    workout_activity_types: workoutActivityTypes,
    weight_logged: weightSorted.length > 0,
    weight_first_value: firstWeight ? firstWeight.weight : null,
    weight_last_value: lastWeight ? lastWeight.weight : null,
    weight_unit: lastWeight ? lastWeight.unit : null,
    weight_last_logged_at: lastWeight ? new Date(lastWeight.logged_at).toISOString() : null,
    steps_total: stepsTotal,
    steps_most_active_local_hour: mostActiveHour,
    sleep_logged: sleepLogs.length > 0,
    sleep_total_duration_minutes: sleepLogs.length > 0 ? sleepTotalMinutes : null,
    sleep_quality: avgQuality,
    heart_rate_avg_bpm: heartRateAvg,
    heart_rate_sample_count: heartRateLogs.length,
  };
}
