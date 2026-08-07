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
  /** Via get_visible_profile_names (migration 0072) -- null falls back
   * to "your client" in the UI, same convention as elsewhere in this
   * file for when a name can't be resolved. */
  clientName: string | null;
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

// ---------------------------------------------------------------------------
// Marketplace/discovery (migration 0071)
// ---------------------------------------------------------------------------

export type TrainerProfile = {
  trainerId: string;
  bio: string | null;
  yearsExperience: number | null;
  specialties: string[];
  locationCity: string | null;
  locationRegion: string | null;
  isDiscoverable: boolean;
};

/** A browse-list row — the profile plus the trainer's display name
 * (profiles.full_name), which trainer_profiles doesn't itself carry. */
export type DiscoverableTrainer = TrainerProfile & {
  fullName: string | null;
};

export type TrainerRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

/** Client-side view of a request they sent. */
export type MyTrainerRequest = {
  id: string;
  trainerId: string;
  trainerName: string | null;
  message: string | null;
  status: TrainerRequestStatus;
  createdAt: string;
};

/** Trainer-side view of a request they received. */
export type IncomingTrainerRequest = {
  id: string;
  clientId: string;
  clientName: string | null;
  message: string | null;
  status: TrainerRequestStatus;
  createdAt: string;
};

/** Self-service "become a trainer" request status -- a different axis
 * than TrainerRequestStatus above (that's a client requesting a specific
 * trainer; this is a user requesting the trainer role itself, reviewed
 * by an admin-owner, see migration 0087). */
export type TrainerRoleRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Requester's own view of their "become a trainer" request. */
export type MyTrainerRoleRequest = {
  id: string;
  message: string | null;
  status: TrainerRoleRequestStatus;
  createdAt: string;
  reviewedAt: string | null;
};
