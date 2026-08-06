"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserAdminStatus } from "@/domains/users/service";
import { SelectInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { AdminRole } from "@/domains/users/types";

export function RoleForm({
  targetUserId,
  currentUserId,
  isAdmin: initialIsAdmin,
  adminRole: initialAdminRole,
}: {
  targetUserId: string;
  currentUserId: string;
  isAdmin: boolean;
  adminRole: AdminRole | null;
}) {
  const router = useRouter();
  const isSelf = targetUserId === currentUserId;
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);
  const [adminRole, setAdminRole] = useState<AdminRole>(initialAdminRole ?? "reviewer");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setUserAdminStatus(targetUserId, {
        isAdmin,
        adminRole: isAdmin ? adminRole : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  if (isSelf) {
    return (
      <p className="text-sm text-neutral-500">
        You can&apos;t change your own admin role from here — this is your own account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
        Has admin portal access
      </label>

      {isAdmin ? (
        <div className="max-w-xs">
          <SelectInput value={adminRole} onChange={(e) => setAdminRole(e.target.value as AdminRole)}>
            <option value="reviewer">Reviewer — content review/management only</option>
            <option value="owner">Owner — full access including ops and user management</option>
          </SelectInput>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved && !isPending ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null}

      <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
        {isPending ? "Saving…" : "Save role"}
      </Button>
    </div>
  );
}
