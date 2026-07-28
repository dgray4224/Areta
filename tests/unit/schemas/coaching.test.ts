import { describe, expect, it } from "vitest";
import { coachingSchema } from "@/domains/coaching/schema";

const validInput = {
  tone: "direct" as const,
  planningStyle: "flexible" as const,
  reminderPreference: "minimal" as const,
  explanationDepth: "brief" as const,
  rescheduleMissedTasks: true,
  neverRecommend: [] as string[],
};

describe("coachingSchema", () => {
  it("accepts valid input", () => {
    expect(coachingSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects an unknown tone", () => {
    expect(coachingSchema.safeParse({ ...validInput, tone: "sarcastic" }).success).toBe(false);
  });

  it("requires neverRecommend to be present", () => {
    const rest: Partial<typeof validInput> = { ...validInput };
    delete rest.neverRecommend;
    expect(coachingSchema.safeParse(rest).success).toBe(false);
  });
});
