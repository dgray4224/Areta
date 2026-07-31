import "server-only";
import type { CalendarProvider } from "@/platform/calendar/provider";
import type { CalendarResult, NormalizedEvent, TokenSet } from "@/platform/calendar/types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type GoogleEventItem = {
  id: string;
  summary?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

/** Plain fetch against Google's REST APIs, not the `googleapis` SDK — see
 * the plan's rule-13 justification (two read-only REST calls don't warrant
 * a large multi-API SDK). */
export class GoogleCalendarProvider implements CalendarProvider {
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      // Both required or Google won't reissue a refresh_token after the
      // very first consent — see the plan's OAuth flow notes.
      access_type: "offline",
      prompt: "consent",
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
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Google token exchange failed: ${await response.text()}` };
    }
    const json = (await response.json()) as GoogleTokenResponse;
    if (!json.refresh_token) {
      return {
        ok: false,
        error: "Google did not return a refresh_token. Reconnect the calendar to try again.",
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
      }),
    });
    if (!response.ok) {
      return { ok: false, error: `Google token refresh failed: ${await response.text()}` };
    }
    const json = (await response.json()) as GoogleTokenResponse;
    return {
      ok: true,
      data: {
        // Google doesn't reissue the refresh token on a refresh call.
        accessToken: json.access_token,
        refreshToken,
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
      return { ok: false, error: "No Google access token available." };
    }
    const params = new URLSearchParams({
      timeMin: range.timeMin,
      timeMax: range.timeMax,
      singleEvents: "true",
      orderBy: "startTime",
    });
    const response = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    if (!response.ok) {
      return { ok: false, error: `Google events fetch failed: ${await response.text()}` };
    }
    const json = (await response.json()) as { items?: GoogleEventItem[] };
    const events = (json.items ?? [])
      .filter((item) => item.status !== "cancelled")
      .map(normalizeGoogleEvent);
    return { ok: true, data: events };
  }
}

function normalizeGoogleEvent(item: GoogleEventItem): NormalizedEvent {
  const allDay = !item.start.dateTime;
  return {
    id: item.id,
    title: item.summary ?? "(No title)",
    startsAt: item.start.dateTime ?? `${item.start.date}T00:00:00.000Z`,
    endsAt: item.end.dateTime ?? `${item.end.date}T00:00:00.000Z`,
    allDay,
    source: "google",
  };
}
