// lib/beta/types.ts
// Domain types for the private beta system. Deliberately kept separate from
// lib/plan.ts — beta is its own entitlement layer, not a commercial tier.

export type BetaInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type BetaMembershipStatus = "active" | "expired" | "revoked";
export type BetaFeature = "outreach" | "followup" | "ai_deep_search";
export type BetaUsageStatus = "reserved" | "committed" | "released";

export type BetaMembership = {
  id: string;
  userId: string;
  invitationId: string | null;
  status: BetaMembershipStatus;
  timezone: string;
  activatedAt: string;
  hardEndAt: string;
  activeDaysUsed: number;
  lastActiveDate: string | null; // YYYY-MM-DD in `timezone`
  extendedDays: number;
  extensionGrantedBy: string | null;
  extensionGrantedAt: string | null;
  expiredAt: string | null;
  revokedAt: string | null;
  finalInterviewCompleted: boolean;
  finalInterviewCompletedAt: string | null;
  requiredFeedbackCompleted: boolean;
  requiredFeedbackCompletedAt: string | null;
  discountEligible: boolean;
  discountAwardedAt: string | null;
  discountRedeemedAt: string | null;
  tutorialState: Record<string, "completed" | "skipped">;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

// Per-feature allowance configuration. Defaults live in lib/beta/config.ts;
// this shape lets an admin override them per tester later (Phase 8) without
// a schema change, by passing explicit numbers instead of the defaults.
export type BetaAllowance = {
  daily: number | null; // null = no daily cap
  total: number | null; // null = unlimited
};

export type BetaAccess =
  | { active: false; reason: "no_membership" | "expired" | "revoked" }
  | {
      active: true;
      membership: BetaMembership;
      daysRemainingActive: number; // 7 - activeDaysUsed (floor 0)
      daysRemainingCalendar: number; // hardEndAt - now, in days (floor 0)
    };

export type BetaUsageReservation = {
  allowed: boolean;
  reason: "ok" | "idempotent_replay" | "daily_limit" | "total_limit" | "monetary_ceiling";
  usageId: number | null;
};
