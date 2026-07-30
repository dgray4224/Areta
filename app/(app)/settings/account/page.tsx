import { requireUser } from "@/platform/auth/session";
import { signOut } from "@/platform/auth/actions";
import { ExportDataButton } from "./ExportDataButton";
import { RestartOnboardingButton } from "./RestartOnboardingButton";

export default async function AccountSettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-neutral-500">Account</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Member since</dt>
            <dd>{user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Your data</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
          Download everything Areta has stored for you as JSON.
        </p>
        <ExportDataButton userId={user.id} />
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Onboarding</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
          Want to redo the initial interview? This resets your goals and plan setup, not your
          logged history.
        </p>
        <RestartOnboardingButton userId={user.id} />
      </section>

      <section className="border-t border-black/5 pt-6 dark:border-white/5">
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm font-medium text-neutral-600 hover:text-brand dark:text-neutral-400"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
