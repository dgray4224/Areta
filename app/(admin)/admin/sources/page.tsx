import { listSources } from "@/domains/expertregistry/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";

export default async function SourcesPage() {
  const sources = await listSources();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <LinkButton href="/admin/sources/new" variant="secondary">
          + New source
        </LinkButton>
      </div>

      {sources.length === 0 ? (
        <EmptyState
          title="No sources yet"
          description="Sources are what expert claims cite — add one before authoring a claim."
        />
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <a key={source.id} href={source.canonicalUrl} target="_blank" rel="noreferrer">
              <Card className="hover:border-brand/40">
                <p className="font-medium">{source.title}</p>
                <p className="text-xs text-neutral-500">
                  {source.organization} · {source.sourceType.replace(/_/g, " ")}
                  {source.expertName ? ` · ${source.expertName}` : ""}
                </p>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
