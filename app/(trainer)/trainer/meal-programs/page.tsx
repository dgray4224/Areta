import Link from "next/link";
import { listMyMealPrograms } from "@/domains/trainermealprogram/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export default async function TrainerMealProgramsPage() {
  const programs = await listMyMealPrograms();

  return (
    <div className="space-y-6">
      <Link href="/trainer" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your nutrition programs</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Write a meal plan once, then assign it to any client. Split into phases like your workout
            programs — portion sizes are set per client once assigned, not here.
          </p>
        </div>
        <LinkButton href="/trainer/meal-programs/new">+ New program</LinkButton>
      </div>

      {programs.length === 0 ? (
        <EmptyState
          title="No nutrition programs yet"
          description="Build your first meal program, then assign it to a client from their nutrition tab."
          action={<LinkButton href="/trainer/meal-programs/new">+ New program</LinkButton>}
        />
      ) : (
        <div className="space-y-3">
          {programs.map((program) => {
            const totalWeeks = program.phases.reduce((sum, p) => sum + p.lengthWeeks, 0);
            return (
              <Link key={program.id} href={`/trainer/meal-programs/${program.id}`}>
                <Card className="transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{program.name}</p>
                      <p className="text-sm text-neutral-500">
                        {program.phases.length === 0
                          ? "No phases yet"
                          : `${program.phases.length} phase${program.phases.length === 1 ? "" : "s"} · ${totalWeeks} week${totalWeeks === 1 ? "" : "s"} per cycle`}
                      </p>
                    </div>
                    <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700">
                      {STATUS_LABEL[program.status]}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
