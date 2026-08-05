import { requireAdminOwner } from "@/platform/auth/admin";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  // Same owner-only gate as /admin/ops — user data is the most sensitive
  // thing in this portal, so this stays owner-only even though most of
  // the rest of Phase B/C is available to reviewers too.
  await requireAdminOwner();
  return <div className="space-y-4">{children}</div>;
}
