import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="text-sm text-neutral-500">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>
    </div>
  );
}
