import type { DomainKey } from "@/domains/goals/schema";

export type SectionKey = "health";

/** Top-level dashboard grouping ("master tabs"). Each section fans out
 * into sub-tabs for its constituent domains. Only "health" is populated
 * for V1 (CLAUDE.md is narrowed to health-only for this phase) — adding a
 * future section (Learning, Family, etc.) is additive, one new entry
 * here, not a restructuring. */
export const SECTIONS: Record<SectionKey, { label: string; domains: DomainKey[] }> = {
  health: { label: "Health", domains: ["nutrition", "exercise", "sleep"] },
};

export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

export function isSectionKey(value: string): value is SectionKey {
  return value in SECTIONS;
}

/** Which sections have at least one domain the user actually has active,
 * in SECTIONS' declared order. */
export function getActiveSections(activeDomainKeys: string[]): SectionKey[] {
  return SECTION_KEYS.filter((key) =>
    SECTIONS[key].domains.some((d) => activeDomainKeys.includes(d))
  );
}

/** Which of a section's domains are active for this user, in the
 * section's declared order — drives the sub-tab row. */
export function getActiveDomainsForSection(section: SectionKey, activeDomainKeys: string[]): DomainKey[] {
  return SECTIONS[section].domains.filter((d) => activeDomainKeys.includes(d));
}
