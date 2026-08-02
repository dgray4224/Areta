// Retention policy for automated HealthKit-import data (CLAUDE.md §14 Apple
// Health Roadmap). Mirrors areta-mobile's client-side cutoff
// (lib/healthkit.ts's HEALTH_IMPORT_RETENTION_YEARS) — enforced here too
// since Areta is multi-user and the mobile app isn't guaranteed to be the
// only future writer to these tables. Manual-entry paths (logWeight,
// logSleep, etc.) are intentionally untouched — a user must always be able
// to log old data by hand.
export const HEALTH_IMPORT_RETENTION_YEARS = 3;

export function isOlderThanHealthImportRetentionWindow(date: Date | string): boolean {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - HEALTH_IMPORT_RETENTION_YEARS);
  return new Date(date) < cutoff;
}
