import Link from "next/link";
import { listSources } from "@/domains/expertregistry/service";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { LimitationRuleForm } from "./LimitationRuleForm";

export default async function NewLimitationRulePage() {
  const [sources, exercises] = await Promise.all([listSources(), getAllExercises()]);

  return (
    <div className="space-y-4">
      <Link href="/admin/limitation-rules" className="text-sm text-neutral-500 hover:underline">
        ← Limitation rules
      </Link>
      <h2 className="text-lg font-semibold">New limitation rule</h2>
      <LimitationRuleForm sources={sources} exercises={exercises} />
    </div>
  );
}
