import { requireUser } from "@/platform/auth/session";
import { ensureProfile } from "@/domains/identity/service";
import { AppHeader } from "./AppHeader";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensureProfile(user.id);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
