import Link from "next/link";
import { listUsersAdmin } from "@/domains/users/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";

export default async function UsersAdminPage() {
  const users = await listUsersAdmin();

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {users.length} {users.length === 1 ? "account" : "accounts"} total. Reads go through the
        service-role client (no RLS path exposes auth.users or cross-user profiles to a regular
        session) — see the comment on domains/users/service.ts.
      </p>

      {users.length === 0 ? (
        <EmptyState title="No users" description="Nothing to show." />
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`}>
              <Card className="flex items-center justify-between hover:border-brand/40">
                <div>
                  <p className="font-medium">{user.fullName || user.email || user.id}</p>
                  <p className="text-xs text-neutral-500">
                    {user.email ?? "no email on file"} · joined{" "}
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {user.isAdmin ? (
                  <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                    {user.adminRole}
                  </span>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
