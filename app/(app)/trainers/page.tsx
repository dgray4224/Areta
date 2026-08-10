import Link from "next/link";
import { listDiscoverableTrainers } from "@/domains/trainer/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { TrainerFilters } from "./TrainerFilters";

export default async function BrowseTrainersPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; specialty?: string }>;
}) {
  const { city, specialty } = await searchParams;
  const trainers = await listDiscoverableTrainers({ city, specialty });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Find a trainer</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Browse trainers who&apos;ve listed themselves publicly.
        </p>
      </div>

      <TrainerFilters initialCity={city ?? ""} initialSpecialty={specialty ?? ""} />

      {trainers.length === 0 ? (
        <EmptyState
          title="No trainers found"
          description={city || specialty ? "Try a different search." : "No trainers are listed publicly yet."}
        />
      ) : (
        <div className="space-y-2">
          {trainers.map((trainer) => (
            <Link key={trainer.trainerId} href={`/trainers/${trainer.trainerId}`}>
              <Card className="hover:border-brand/40">
                <p className="font-medium">{trainer.fullName || "Unnamed trainer"}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {[trainer.locationCity, trainer.locationRegion].filter(Boolean).join(", ") || "Location not set"}
                  {trainer.yearsExperience ? ` · ${trainer.yearsExperience} years experience` : ""}
                </p>
                {trainer.specialties.length > 0 ? (
                  <p className="mt-1 text-xs text-neutral-500">{trainer.specialties.join(", ")}</p>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
