import { requireUser } from "@/platform/auth/session";
import { getRecentWorkoutLogs } from "@/domains/workout/service";

// activity_type is stored as the HealthKit enum key (e.g. "highIntensityIntervalTraining")
// rather than a display label — humanize it here instead of baking formatting into the data.
function humanizeActivityType(activityType: string): string {
  const spaced = activityType.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default async function HealthDataSettingsPage() {
  const user = await requireUser();
  const workouts = await getRecentWorkoutLogs(user.id, 30);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-neutral-500">Workouts (last 30 days)</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
          Imported from Apple Health via the Areta iOS companion app.
        </p>

        {workouts.length === 0 ? (
          <p className="text-sm text-neutral-500">No workouts synced in the last 30 days.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 pr-4 font-medium">Calories</th>
                  <th className="py-2 pr-4 font-medium">Distance</th>
                  <th className="py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {workouts.map((workout) => (
                  <tr
                    key={workout.id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="py-2 pr-4">
                      {new Date(workout.start_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-2 pr-4">{humanizeActivityType(workout.activity_type)}</td>
                    <td className="py-2 pr-4">{workout.duration_minutes} min</td>
                    <td className="py-2 pr-4">
                      {workout.total_energy_burned_kcal
                        ? `${Math.round(workout.total_energy_burned_kcal)} kcal`
                        : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      {workout.total_distance_meters
                        ? `${(workout.total_distance_meters / 1000).toFixed(2)} km`
                        : "—"}
                    </td>
                    <td className="py-2 text-neutral-500">{workout.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
