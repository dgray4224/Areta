import Link from "next/link";
import { notFound } from "next/navigation";
import { getSource } from "@/domains/expertregistry/service";
import { Card } from "@/platform/ui/Card";
import { SourceStatusActions } from "./SourceStatusActions";

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/evidence" className="text-sm text-neutral-500 hover:underline">
        ← Evidence
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{source.title}</h2>
          <p className="text-sm text-neutral-500">
            {source.organization} · {source.sourceType.replace(/_/g, " ")}
          </p>
        </div>
        <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
          {source.status}
        </span>
      </div>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Canonical URL</p>
          <a href={source.canonicalUrl} target="_blank" rel="noreferrer" className="text-sm hover:underline">
            {source.canonicalUrl}
          </a>
        </div>
        {source.expertName ? (
          <div>
            <p className="text-xs font-medium text-neutral-500">Expert</p>
            <p className="text-sm">{source.expertName}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-neutral-500">Published</p>
            <p className="text-sm">{source.publishedAt ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Accessed</p>
            <p className="text-sm">{source.accessedAt}</p>
          </div>
        </div>
      </Card>

      <SourceStatusActions sourceId={source.id} currentStatus={source.status} />
    </div>
  );
}
