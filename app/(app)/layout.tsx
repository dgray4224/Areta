import { requireUser } from "@/platform/auth/session";
import { ensureProfile } from "@/domains/identity/service";
import { signOut } from "@/platform/auth/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensureProfile(user.id);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <span className="font-semibold">LifeOS</span>
        <form action={signOut}>
          <button type="submit" className="text-sm text-neutral-500 hover:underline">
            Sign out
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
