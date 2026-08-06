import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getTrainerPublicProfile,
  getMyTrainerRelationship,
  listMyTrainerRequests,
} from "@/domains/trainer/service";
import { Card } from "@/platform/ui/Card";
import { RequestTrainerButton } from "./RequestTrainerButton";

export default async function TrainerPublicProfilePage({ params }: { params: Promise<{ trainerId: string }> }) {
  const { trainerId } = await params;
  const [trainer, myTrainer, myRequests] = await Promise.all([
    getTrainerPublicProfile(trainerId),
    getMyTrainerRelationship(),
    listMyTrainerRequests(),
  ]);
  if (!trainer) notFound();

  const pendingRequestToThisTrainer = myRequests.some((r) => r.trainerId === trainerId && r.status === "pending");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/trainers" className="text-sm text-neutral-500 hover:underline">
        ← Find a trainer
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{trainer.fullName || "Unnamed trainer"}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {[trainer.locationCity, trainer.locationRegion].filter(Boolean).join(", ") || "Location not set"}
          {trainer.yearsExperience ? ` · ${trainer.yearsExperience} years experience` : ""}
        </p>
      </div>

      {trainer.specialties.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {trainer.specialties.map((s) => (
            <span
              key={s}
              className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}

      {trainer.bio ? (
        <Card>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{trainer.bio}</p>
        </Card>
      ) : null}

      {myTrainer ? (
        myTrainer.trainerId === trainerId ? (
          <p className="text-sm text-neutral-500">This is already your trainer.</p>
        ) : (
          <p className="text-sm text-neutral-500">
            You already have an active trainer — end that relationship (Settings → Trainer) before
            requesting a new one.
          </p>
        )
      ) : pendingRequestToThisTrainer ? (
        <p className="text-sm text-green-700 dark:text-green-400">Request sent — waiting on a response.</p>
      ) : (
        <RequestTrainerButton trainerId={trainerId} />
      )}
    </div>
  );
}
