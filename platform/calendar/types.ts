export type CalendarProviderId = "google" | "microsoft" | "apple";

export type NormalizedEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  source: CalendarProviderId;
};

/**
 * For Google/Microsoft this is a real OAuth token pair. For Apple (CalDAV,
 * no OAuth) `refreshToken` holds the app-specific password, `accessToken` is
 * always null, and `expiresAt` is a far-future sentinel — see the comment on
 * `calendar_connections` in supabase/migrations/0012_calendar_integration.sql.
 */
export type TokenSet = {
  accessToken: string | null;
  refreshToken: string;
  expiresAt: string;
  scope: string;
  accountEmail?: string;
};

export type CalendarResult<T> = { ok: true; data: T } | { ok: false; error: string };
