import { requireUser } from "@/platform/auth/session";
import { ensureProfile } from "@/domains/identity/service";
import { AppHeader } from "./AppHeader";
import { BottomTabBar } from "./BottomTabBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await ensureProfile(user.id);

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />
      <main className="pb-24 xl:pb-0">{children}</main>
      <BottomTabBar />
    </div>
  );
}
