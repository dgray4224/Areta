import Link from "next/link";
import { listExperts } from "@/domains/expertregistry/service";
import { SourceForm } from "./SourceForm";

export default async function NewSourcePage() {
  const experts = await listExperts();

  return (
    <div className="space-y-4">
      <Link href="/admin/sources" className="text-sm text-neutral-500 hover:underline">
        ← Sources
      </Link>
      <h2 className="text-lg font-semibold">New source</h2>
      <SourceForm experts={experts} />
    </div>
  );
}
