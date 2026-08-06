import Link from "next/link";
import { requireTrainer } from "@/platform/auth/trainer";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  await requireTrainer();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Areta
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your clients</h1>
          <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700">
            Trainer
          </span>
        </div>
      </div>

      {children}
    </div>
  );
}
