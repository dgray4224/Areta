import { requireUser } from "@/platform/auth/session";
import { getConnections } from "@/domains/calendar/connections-service";
import { isProviderConfigured } from "@/platform/calendar/get-provider";
import { beginGoogleCalendarConnect, beginMicrosoftCalendarConnect } from "@/domains/calendar/connect-actions";
import { ConnectionRow } from "./ConnectionRow";
import { AppleConnectForm } from "./AppleConnectForm";

export default async function CalendarSettingsPage() {
  const user = await requireUser();
  const connections = await getConnections(user.id);
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-neutral-500">Calendars</h2>
        <p className="mt-1 mb-3 text-sm text-neutral-600 dark:text-neutral-400">
          Connect a calendar (read-only) so Areta can show what&apos;s on your schedule and
          recommend open times to work on your goals.
        </p>
        <div className="space-y-3">
          <ConnectionRow
            label="Google Calendar"
            provider="google"
            connection={byProvider.get("google") ?? null}
            configured={isProviderConfigured("google")}
            connectAction={beginGoogleCalendarConnect}
          />
          <ConnectionRow
            label="Outlook / Microsoft"
            provider="microsoft"
            connection={byProvider.get("microsoft") ?? null}
            configured={isProviderConfigured("microsoft")}
            connectAction={beginMicrosoftCalendarConnect}
          />
          {byProvider.get("apple") ? (
            <ConnectionRow
              label="Apple Calendar (iCloud)"
              provider="apple"
              connection={byProvider.get("apple") ?? null}
              configured
            />
          ) : (
            <AppleConnectForm />
          )}
        </div>
      </section>
    </div>
  );
}
