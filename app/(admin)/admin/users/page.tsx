import Link from "next/link";
import { listUsersAdmin } from "@/domains/users/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { UserSearchBox } from "./UserSearchBox";

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const allUsers = await listUsersAdmin();
  const query = (q ?? "").trim().toLowerCase();
  const users = query
    ? allUsers.filter(
        (u) =>
          (u.fullName ?? "").toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query)
      )
    : allUsers;

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {allUsers.length} {allUsers.length === 1 ? "account" : "accounts"} total
        {query ? `, ${users.length} matching "${q}"` : ""}. Reads go through the service-role
        client (no RLS path exposes auth.users or cross-user profiles to a regular session) — see
        the comment on domains/users/service.ts.
      </p>

      <UserSearchBox initialQuery={q ?? ""} />

      {users.length === 0 ? (
        <EmptyState
          title="No users"
          description={query ? "No accounts match this search." : "Nothing to show."}
        />
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
                <div className="flex shrink-0 gap-1.5">
                  {user.isAdmin ? (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                      {user.adminRole}
                    </span>
                  ) : null}
                  {user.isTrainer ? (
                    <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                      trainer
                    </span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
