import { describe, expect, it } from "vitest";
import { assessWeeklyBriefHealth, STALE_AFTER_DAYS, summarizeError } from "@/domains/observability/ai-health";

const NOW = new Date("2026-09-19T12:00:00Z");

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

const KEY_ERROR = '401 {"type":"error","error":{"type":"authentication_error","message":"API key is invalid."}}';

describe("assessWeeklyBriefHealth", () => {
  it("is healthy when a brief generated within the week", () => {
    const verdict = assessWeeklyBriefHealth({
      runs: [{ createdAt: daysAgo(2), success: true, error: null }],
      eligibleUsers: 13,
      now: NOW,
    });
    expect(verdict.healthy).toBe(true);
    expect(verdict.reason).toBeNull();
  });

  it("catches the outage that actually happened: runs firing, all failing", () => {
    const verdict = assessWeeklyBriefHealth({
      runs: [
        ...Array.from({ length: 13 }, () => ({ createdAt: daysAgo(0.1), success: false, error: KEY_ERROR })),
        { createdAt: daysAgo(27), success: true, error: null },
      ],
      eligibleUsers: 13,
      now: NOW,
    });
    expect(verdict.healthy).toBe(false);
    expect(verdict.reason).toContain("Every weekly brief failed");
    expect(verdict.detail).toContain("API key is invalid");
  });

  it("catches a silently dead cron, where there are no failures to count", () => {
    const verdict = assessWeeklyBriefHealth({
      runs: [{ createdAt: daysAgo(STALE_AFTER_DAYS + 3), success: true, error: null }],
      eligibleUsers: 13,
      now: NOW,
    });
    expect(verdict.healthy).toBe(false);
    expect(verdict.reason).toContain("No weekly brief has generated");
  });

  it("catches a cron that has never produced anything", () => {
    const verdict = assessWeeklyBriefHealth({ runs: [], eligibleUsers: 13, now: NOW });
    expect(verdict.healthy).toBe(false);
    expect(verdict.detail).toContain("cron itself may not be running");
  });

  it("stays quiet when no user has a review day, so there is nothing to expect", () => {
    const verdict = assessWeeklyBriefHealth({ runs: [], eligibleUsers: 0, now: NOW });
    expect(verdict.healthy).toBe(true);
  });

  it("does not cry outage over one user failing among many", () => {
    const verdict = assessWeeklyBriefHealth({
      runs: [
        { createdAt: daysAgo(0.1), success: false, error: "bad data for one user" },
        { createdAt: daysAgo(0.1), success: true, error: null },
      ],
      eligibleUsers: 13,
      now: NOW,
    });
    expect(verdict.healthy).toBe(true);
  });

  it("reports the boundary as stale only once it is past", () => {
    const justInside = assessWeeklyBriefHealth({
      runs: [{ createdAt: daysAgo(STALE_AFTER_DAYS - 0.5), success: true, error: null }],
      eligibleUsers: 1,
      now: NOW,
    });
    expect(justInside.healthy).toBe(true);
  });
});

describe("summarizeError", () => {
  it("collapses a provider error blob to one readable line", () => {
    expect(summarizeError(KEY_ERROR)).toContain("API key is invalid");
    expect(summarizeError(KEY_ERROR)).not.toContain("\n");
  });

  it("handles a missing error", () => {
    expect(summarizeError(null)).toBe("no error text recorded");
  });

  it("truncates a very long error", () => {
    expect(summarizeError("x".repeat(500)).length).toBeLessThanOrEqual(160);
  });
});
