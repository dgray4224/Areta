import Link from "next/link";
import { requireAdmin } from "@/platform/auth/admin";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminRole } = await requireAdmin();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to Areta
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-500 dark:border-neutral-700">
            {adminRole === "owner" ? "Owner" : "Reviewer"}
          </span>
        </div>
      </div>

      <AdminNav adminRole={adminRole} />

      {children}
    </div>
  );
}
