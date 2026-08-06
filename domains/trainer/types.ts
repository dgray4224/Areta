/** Trainer role (2026-08-06 B2B2C addition) — a trainer's own view of
 * their assigned clients, separate from the internal admin domains. See
 * platform/auth/trainer.ts and migrations 0066/0067 for the access-control
 * side this reads through. */

export type TrainerClientSummary = {
  relationshipId: string;
  clientId: string;
  fullName: string | null;
  startedAt: string;
};

export type InviteCode = {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedByName: string | null;
  revokedAt: string | null;
};

export type ClientGoal = {
  id: string;
  outcome: string;
  why: string | null;
  targetDate: string | null;
  priority: number | null;
  confidence: number | null;
  status: "active" | "achieved" | "abandoned";
};

export type ClientHistorySummary = {
  recentWeightLogs: Array<{ id: string; loggedAt: string; weight: number; unit: string }>;
  recentSleepLogs: Array<{ id: string; date: string; totalDurationMinutes: number | null; quality: number | null }>;
  recentNutritionLogs: Array<{ id: string; date: string; meal: string; food: string; calories: number | null }>;
  recentRecoveryLogs: Array<{ id: string; date: string; pain: number | null; energy: number | null }>;
  goals: ClientGoal[];
};

/** The client-side view of their own trainer relationship (settings ->
 * trainer). Null when no active trainer. */
export type MyTrainerInfo = {
  relationshipId: string;
  trainerId: string;
  trainerName: string | null;
  startedAt: string;
};
