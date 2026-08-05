import Link from "next/link";
import { listExperts, listSources } from "@/domains/expertregistry/service";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { ClaimForm } from "./ClaimForm";

export default async function NewClaimPage() {
  const [experts, sources, exercises] = await Promise.all([
    listExperts(),
    listSources(),
    getAllExercises(),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/admin/claims" className="text-sm text-neutral-500 hover:underline">
        ← Claims
      </Link>
      <h2 className="text-lg font-semibold">New claim</h2>
      {experts.length === 0 || sources.length === 0 ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {experts.length === 0 ? "Add an expert" : "Add a source"} before authoring a claim — every
          claim must cite both.
        </p>
      ) : null}
      <ClaimForm experts={experts} sources={sources} exercises={exercises} />
    </div>
  );
}
