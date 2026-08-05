import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserAdmin } from "@/domains/users/service";
import { requireAdminOwner } from "@/platform/auth/admin";
import { Card } from "@/platform/ui/Card";
import { RoleForm } from "./RoleForm";
import { DeleteUserSection } from "./DeleteUserSection";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user: currentUser } = await requireAdminOwner();
  const user = await getUserAdmin(id);
  if (!user) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm text-neutral-500 hover:underline">
        ← Users
      </Link>

      <div>
        <h2 className="text-lg font-semibold">{user.fullName || user.email || user.id}</h2>
        <p className="text-sm text-neutral-500">{user.email ?? "no email on file"}</p>
      </div>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Joined</p>
          <p className="text-sm">{new Date(user.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Last sign-in</p>
          <p className="text-sm">
            {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "Never"}
          </p>
        </div>
      </Card>

      <div className="space-y-2">
        <p className="text-sm font-medium">Admin role</p>
        <RoleForm
          targetUserId={user.id}
          currentUserId={currentUser.id}
          isAdmin={user.isAdmin}
          adminRole={user.adminRole}
        />
      </div>

      <DeleteUserSection targetUserId={user.id} currentUserId={currentUser.id} email={user.email} />
    </div>
  );
}
