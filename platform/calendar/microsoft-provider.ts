import "server-only";
import type { CalendarProvider } from "@/platform/calendar/provider";
import type { CalendarResult, NormalizedEvent, TokenSet } from "@/platform/calendar/types";

const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const EVENTS_URL = "https://graph.microsoft.com/v1.0/me/calendarView";
// offline_access must be requested explicitly as a scope here — unlike
// Google's access_type=offline flag, Graph has no separate mechanism for
// asking for a refresh token.
const SCOPE = "offline_access Calendars.Read";

type GraphTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type GraphEventItem = {
  id: string;
  subject?: string;
  isAllDay?: boolean;
  start: { dateTime: string };
  end: { dateTime: string };
};

/** Plain fetch against Microsoft Graph's REST API, not the
 * `@microsoft/microsoft-graph-client` SDK — same rule-13 reasoning as the
 * Google provider. */
export class MicrosoftCalendarProvider implements CalendarProvider {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: SCOPE,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<CalendarResult<TokenSet>> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: SCOPE,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Microsoft token exchange failed: ${await response.text()}` };
    }
    const json = (await response.json()) as GraphTokenResponse;
    if (!json.refresh_token) {
      return {
        ok: false,
        error: "Microsoft did not return a refresh_token. Reconnect the calendar to try again.",
      };
    }
    return {
      ok: true,
      data: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token,
        expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
        scope: json.scope ?? SCOPE,
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<CalendarResult<TokenSet>> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        scope: SCOPE,
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Microsoft token refresh failed: ${await response.text()}` };
    }
    const json = (await response.json()) as GraphTokenResponse;
    return {
      ok: true,
      data: {
        accessToken: json.access_token,
        // Graph does sometimes reissue a refresh token; fall back to the old one if not.
        refreshToken: json.refresh_token ?? refreshToken,
        expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
        scope: json.scope ?? SCOPE,
      },
    };
  }

  async listEvents(
    credentials: TokenSet,
    range: { timeMin: string; timeMax: string }
  ): Promise<CalendarResult<NormalizedEvent[]>> {
    if (!credentials.accessToken) {
      return { ok: false, error: "No Microsoft access token available." };
    }
    const params = new URLSearchParams({
      startDateTime: range.timeMin,
      endDateTime: range.timeMax,
    });
    const response = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!response.ok) {
      return { ok: false, error: `Microsoft events fetch failed: ${await response.text()}` };
    }
    const json = (await response.json()) as { value?: GraphEventItem[] };
    const events = (json.value ?? []).map(normalizeGraphEvent);
    return { ok: true, data: events };
  }
}

function normalizeGraphEvent(item: GraphEventItem): NormalizedEvent {
  // The Prefer: outlook.timezone="UTC" header above means these dateTime
  // strings are already UTC wall-clock time without a trailing "Z" — same
  // UTC-based simplification this app already uses elsewhere (see the
  // freebusy algorithm's timezone note).
  return {
    id: item.id,
    title: item.subject ?? "(No title)",
    startsAt: `${item.start.dateTime}Z`,
    endsAt: `${item.end.dateTime}Z`,
    allDay: item.isAllDay ?? false,
    source: "microsoft",
  };
}
