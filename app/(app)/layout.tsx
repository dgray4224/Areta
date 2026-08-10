import { requireUser } from "@/platform/auth/session";
import { ensureProfile } from "@/domains/identity/service";
import { getAdminStatus } from "@/platform/auth/admin";
import { getTrainerStatus } from "@/platform/auth/trainer";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";
import { Sidebar } from "./Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensureProfile(user.id);
  const [{ isAdmin }, isTrainer] = await Promise.all([getAdminStatus(user.id), getTrainerStatus(user.id)]);

  return (
    <div className="min-h-screen bg-canvas xl:flex">
      <Sidebar isAdmin={isAdmin} isTrainer={isTrainer} />
      {/* min-w-0 keeps this column from being pushed wider than the
       * viewport by its own content (long tables, charts) once it's a
       * flex sibling of Sidebar — a bare flex-1 child doesn't shrink
       * below its content's intrinsic width otherwise. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 pb-24 xl:pb-0">{children}</main>
      </div>
      <BottomTabBar />
    </div>
  );
}
