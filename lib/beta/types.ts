// lib/beta/types.ts
// Domain types for the private beta system. Deliberately kept separate from
// lib/plan.ts — beta is its own entitlement layer, not a commercial tier.

export type BetaInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type BetaMembershipStatus = "active" | "expired" | "revoked" | "converted";
export type BetaFeature = "outreach" | "followup" | "ai_deep_search";
export type BetaUsageStatus = "reserved" | "committed" | "released";
export type BetaDiscountStatus = "pending" | "earned" | "redeemed" | "expired";
export type BetaTestimonialStatus = "pending" | "approved" | "revoked";

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
  convertedAt: string | null;
  monetaryCeilingMicroUsd: number | null; // null = use global default from lib/beta/config.ts
  finalInterviewCompleted: boolean;
  finalInterviewCompletedAt: string | null;
  requiredFeedbackCompleted: boolean;
  requiredFeedbackCompletedAt: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BetaTutorialProgress = {
  id: number;
  membershipId: string;
  userId: string;
  tutorialKey: string;
  tutorialVersion: string;
  currentStep: number;
  startedAt: string;
  completedAt: string | null;
  skippedAt: string | null;
  replayCount: number;
  updatedAt: string;
};

export type BetaDiscountGrant = {
  id: string;
  membershipId: string;
  userId: string;
  source: string;
  percent: number;
  durationMonths: number;
  eligibleAt: string;
  redemptionDeadline: string | null; // null until official launch date is known
  status: BetaDiscountStatus;
  redeemedAt: string | null;
  subscriptionReference: string | null;
  createdAt: string;
};

export type BetaTestimonial = {
  id: string;
  membershipId: string;
  userId: string;
  approvedQuote: string | null;
  approvedName: string | null;
  approvedRole: string | null;
  approvedCompany: string | null;
  logoPermission: boolean;
  photoPermission: boolean;
  permittedChannels: string[];
  status: BetaTestimonialStatus;
  approvedAt: string | null;
  revokedAt: string | null;
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
