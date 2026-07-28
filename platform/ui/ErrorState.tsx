export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900 dark:bg-red-950"
    >
      <p className="font-medium text-red-800 dark:text-red-200">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-red-600 dark:text-red-300">{description}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
