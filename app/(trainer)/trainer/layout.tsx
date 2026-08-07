import Link from "next/link";
import { requireTrainer } from "@/platform/auth/trainer";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  await requireTrainer();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Link href="/settings/trainer" className="text-sm text-neutral-500 hover:underline">
            ← Settings
          </Link>
          <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
            Areta
          </Link>
        </div>
        <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700">
          Trainer
        </span>
      </div>

      {children}
    </div>
  );
}
