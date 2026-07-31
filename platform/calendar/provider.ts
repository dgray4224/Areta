import type { CalendarResult, NormalizedEvent, TokenSet } from "@/platform/calendar/types";

/**
 * Google/Microsoft implement the full OAuth surface (getAuthUrl/exchangeCode/
 * refreshAccessToken) via a redirect-based consent flow. Apple has no OAuth
 * API for CalDAV — it connects via a credential form (see
 * domains/calendar/connect-actions.ts's connectAppleCalendar) and only
 * implements listEvents, so the OAuth methods are optional rather than
 * forcing Apple's provider to stub them out with throws.
 */
export interface CalendarProvider {
  getAuthUrl?(state: string, redirectUri: string): string;
  exchangeCode?(code: string, redirectUri: string): Promise<CalendarResult<TokenSet>>;
  refreshAccessToken?(refreshToken: string): Promise<CalendarResult<TokenSet>>;
  listEvents(
    credentials: TokenSet,
    range: { timeMin: string; timeMax: string }
  ): Promise<CalendarResult<NormalizedEvent[]>>;
}
