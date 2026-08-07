import Link from "next/link";
import { getMyTrainerProfile } from "@/domains/trainer/service";
import { TrainerProfileForm } from "./TrainerProfileForm";

export default async function TrainerProfilePage() {
  const profile = await getMyTrainerProfile();

  return (
    <div className="space-y-6">
      <Link href="/trainer" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <div>
        <h2 className="text-lg font-semibold">Your public profile</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Fill this out before you go public. Clients can only find you once you check &quot;Listed
          publicly&quot; below.
        </p>
      </div>
      <TrainerProfileForm initialProfile={profile} />
    </div>
  );
}
