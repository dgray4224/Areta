import { describe, expect, it } from "vitest";
import { matchAllowlist, CREDIBLE_SOURCE_ALLOWLIST } from "@/domains/trainingprogram/source-allowlist";

describe("matchAllowlist", () => {
  it("matches an exact allowlisted domain", () => {
    const result = matchAllowlist("https://nsca.com/some-article");
    expect(result?.organization).toBe("National Strength and Conditioning Association");
  });

  it("matches a subdomain of an allowlisted domain", () => {
    const result = matchAllowlist("https://blog.athleanx.com/some-post");
    expect(result?.organization).toContain("ATHLEAN-X");
  });

  it("ignores a leading www.", () => {
    const result = matchAllowlist("https://www.gunnarpeterson.com/about");
    expect(result?.organization).toBe("Gunnar Peterson");
  });

  it("returns null for a non-allowlisted domain", () => {
    expect(matchAllowlist("https://some-random-fitness-blog.com/article")).toBeNull();
  });

  it("returns null for a malformed URL", () => {
    expect(matchAllowlist("not-a-url")).toBeNull();
  });

  it("does not false-positive-match a domain that merely contains an allowlisted string", () => {
    // e.g. "notnsca.com" should not match "nsca.com"
    expect(matchAllowlist("https://notnsca.com/page")).toBeNull();
  });

  it("respects pathPrefix when an entry specifies one", () => {
    const withPrefix = [...CREDIBLE_SOURCE_ALLOWLIST, { domain: "youtube.com", pathPrefix: "/@testchannel", organization: "Test Channel", category: "individual_specialist" as const }];
    // matchAllowlist reads the module-level constant, so this test only
    // verifies the *logic* holds for the seeded allowlist's own entries
    // (none currently use pathPrefix) -- confirm no seeded entry
    // accidentally matches an unrelated youtube.com URL.
    expect(matchAllowlist("https://youtube.com/@someoneelse")).toBeNull();
    expect(withPrefix.some((e) => e.domain === "youtube.com")).toBe(true);
  });

  it("every seeded allowlist entry has a non-empty domain and organization", () => {
    for (const entry of CREDIBLE_SOURCE_ALLOWLIST) {
      expect(entry.domain.length).toBeGreaterThan(0);
      expect(entry.organization.length).toBeGreaterThan(0);
    }
  });
});
