export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-6 py-10 text-center dark:border-neutral-700">
      <p className="font-medium text-neutral-800 dark:text-neutral-200">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-neutral-500">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
