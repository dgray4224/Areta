import { requireAdminOwner } from "@/platform/auth/admin";
import { OpsNav } from "./OpsNav";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  // Bounces reviewers back to /admin — this is the first real caller of
  // requireAdminOwner() (built in Phase A, unused until now). AdminNav
  // already hides the "Ops" tab from reviewers, so reaching this
  // requires typing the URL directly.
  await requireAdminOwner();

  return (
    <div className="space-y-4">
      <OpsNav />
      {children}
    </div>
  );
}
