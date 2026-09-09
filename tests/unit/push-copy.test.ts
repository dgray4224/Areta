import { describe, expect, it } from "vitest";
import { REVIEW_PUSH_FALLBACK_BODY, reviewPushBody } from "@/domains/review/push-copy";

describe("reviewPushBody (the review-day push leads with the brief's action)", () => {
  it("strips the brief's markdown-lite markers", () => {
    expect(reviewPushBody("Move **Thursday's lift** to *Friday* — you slept 5h the last three Wednesdays.")).toBe(
      "Move Thursday's lift to Friday — you slept 5h the last three Wednesdays."
    );
  });

  it("falls back to the generic line when the brief has no action", () => {
    expect(reviewPushBody(null)).toBe(REVIEW_PUSH_FALLBACK_BODY);
    expect(reviewPushBody("  ")).toBe(REVIEW_PUSH_FALLBACK_BODY);
  });

  it("cuts a long action at a word boundary with an ellipsis", () => {
    const long = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const body = reviewPushBody(long);
    expect(body.length).toBeLessThanOrEqual(141);
    expect(body.endsWith("…")).toBe(true);
    // Ended on a whole word, not mid-token.
    const lastToken = body.slice(0, -1).split(" ").pop();
    expect(long.split(" ")).toContain(lastToken);
  });
});
