import Link from "next/link";
import { listExperts, listSources } from "@/domains/expertregistry/service";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { EvidenceBundleForm } from "./EvidenceBundleForm";

export default async function NewEvidencePage() {
  const [experts, sources, exercises] = await Promise.all([
    listExperts(),
    listSources(),
    getAllExercises(),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/admin/evidence" className="text-sm text-neutral-500 hover:underline">
        ← Evidence
      </Link>

      <div>
        <h2 className="text-lg font-semibold">Add evidence</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          One coherent submission: pick or add an expert, pick or add a source, record the claim, and
          optionally attach a limitation rule cited from the same source — instead of four separate
          forms you&apos;d have to wire together by hand.
        </p>
      </div>

      <EvidenceBundleForm experts={experts} sources={sources} exercises={exercises} />
    </div>
  );
}
