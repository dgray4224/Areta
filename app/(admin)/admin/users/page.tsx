import Link from "next/link";
import { listUsersAdmin } from "@/domains/users/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { UserSearchBox } from "./UserSearchBox";
import { RoleFilterTabs } from "./RoleFilterTabs";

const ROLE_FILTERS = ["trainer", "admin", "none"] as const;
type RoleFilter = (typeof ROLE_FILTERS)[number];

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { q, role } = await searchParams;
  const allUsers = await listUsersAdmin();
  const query = (q ?? "").trim().toLowerCase();
  const roleFilter = ROLE_FILTERS.includes(role as RoleFilter) ? (role as RoleFilter) : undefined;

  let users = query
    ? allUsers.filter(
        (u) =>
          (u.fullName ?? "").toLowerCase().includes(query) ||
          (u.email ?? "").toLowerCase().includes(query)
      )
    : allUsers;
  if (roleFilter === "trainer") users = users.filter((u) => u.isTrainer);
  else if (roleFilter === "admin") users = users.filter((u) => u.isAdmin);
  else if (roleFilter === "none") users = users.filter((u) => !u.isAdmin && !u.isTrainer);

  const filterNotes = [
    query ? `matching "${q}"` : null,
    roleFilter ? `role: ${roleFilter === "none" ? "no role" : roleFilter}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {allUsers.length} {allUsers.length === 1 ? "account" : "accounts"} total
        {filterNotes.length ? `, ${users.length} shown (${filterNotes.join(", ")})` : ""}. Reads go
        through the service-role client (no RLS path exposes auth.users or cross-user profiles to
        a regular session) — see the comment on domains/users/service.ts.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <UserSearchBox initialQuery={q ?? ""} />
        <RoleFilterTabs q={q} current={roleFilter} />
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="No users"
          description={query || roleFilter ? "No accounts match this filter." : "Nothing to show."}
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
