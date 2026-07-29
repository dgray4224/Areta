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

export type TimezoneOption = { value: string; label: string };

/** IANA identifiers are city-based ("America/Los_Angeles") rather than
 * abbreviations ("PST") specifically so they resolve DST automatically —
 * but that's not obvious to someone reading the raw string, so the visible
 * label leads with the city and current abbreviation instead. */
function cityName(tz: string): string {
  const parts = tz.split("/");
  return parts[parts.length - 1].replace(/_/g, " ");
}

function abbreviation(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** Full IANA list where supported (all evergreen browsers + Node 18+);
 * falls back to a short common list on anything older. Labels lead with
 * the city name and current abbreviation ("Los Angeles — PST") so the
 * raw IANA identifier doesn't have to be self-explanatory on its own. */
export function getTimezoneOptions(): TimezoneOption[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = FALLBACK_TIMEZONES;
  }

  return zones
    .map((tz) => {
      const abbr = abbreviation(tz);
      return {
        value: tz,
        label: abbr ? `${cityName(tz)} — ${abbr} (${tz})` : `${cityName(tz)} (${tz})`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** The browser's own detected timezone, for defaulting the select without
 * making the user look it up. Reflects the device's configured timezone
 * setting, not GPS location — a misconfigured device (e.g. left set to a
 * previous location) will report that setting, not where the user
 * actually is. */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
