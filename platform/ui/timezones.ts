const FALLBACK_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

/** Full IANA list where supported (all evergreen browsers + Node 18+);
 * falls back to a short common list on anything older. */
export function getTimezoneOptions(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone").sort();
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

/** The browser's own detected timezone, for defaulting the select without
 * making the user look it up. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
