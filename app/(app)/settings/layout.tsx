import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { getAdminStatus } from "@/platform/auth/admin";
import { SettingsNav } from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { isAdmin } = await getAdminStatus(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Settings</h1>
      </div>

      <SettingsNav isAdmin={isAdmin} />

      {children}
    </div>
  );
}
