import Link from "next/link";
import { ExpertForm } from "./ExpertForm";

export default function NewExpertPage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/experts" className="text-sm text-neutral-500 hover:underline">
        ← Experts
      </Link>
      <h2 className="text-lg font-semibold">New expert</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Starts as <span className="font-medium">candidate</span> — approve it from the detail page once
        you&apos;ve reviewed credentials and inclusion rationale.
      </p>
      <ExpertForm />
    </div>
  );
}
