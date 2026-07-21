// lib/beta/access.ts
// Core private-beta access resolution. Deliberately independent of
// lib/plan.ts — a beta membership is its own entitlement, not a commercial
// plan. Application code decides separately (per Phase 2+) that an active
// beta member should get operator-equivalent access to core features;
// this module only answers "does this user have active beta access, and
// what's their standing."

import { getBetaServiceClient } from "./serviceClient";
import { BETA_ACTIVE_DAYS_LIMIT, BETA_TIMEZONE } from "./config";
import type { BetaAccess, BetaMembership, BetaMembershipStatus } from "./types";

type MembershipRow = {
  id: string;
  user_id: string;
  invitation_id: string | null;
  status: BetaMembershipStatus;
  timezone: string;
  activated_at: string;
  hard_end_at: string;
  active_days_used: number;
  last_active_date: string | null;
  extended_days: number;
  extension_granted_by: string | null;
  extension_granted_at: string | null;
  expired_at: string | null;
  revoked_at: string | null;
  final_interview_completed: boolean;
  final_interview_completed_at: string | null;
  required_feedback_completed: boolean;
  required_feedback_completed_at: string | null;
  discount_eligible: boolean;
  discount_awarded_at: string | null;
  discount_redeemed_at: string | null;
  tutorial_state: Record<string, "completed" | "skipped">;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: MembershipRow): BetaMembership {
  return {
    id: row.id,
    userId: row.user_id,
    invitationId: row.invitation_id,
    status: row.status,
    timezone: row.timezone,
    activatedAt: row.activated_at,
    hardEndAt: row.hard_end_at,
    activeDaysUsed: row.active_days_used,
    lastActiveDate: row.last_active_date,
    extendedDays: row.extended_days,
    extensionGrantedBy: row.extension_granted_by,
    extensionGrantedAt: row.extension_granted_at,
    expiredAt: row.expired_at,
    revokedAt: row.revoked_at,
    finalInterviewCompleted: row.final_interview_completed,
    finalInterviewCompletedAt: row.final_interview_completed_at,
    requiredFeedbackCompleted: row.required_feedback_completed,
    requiredFeedbackCompletedAt: row.required_feedback_completed_at,
    discountEligible: row.discount_eligible,
    discountAwardedAt: row.discount_awarded_at,
    discountRedeemedAt: row.discount_redeemed_at,
    tutorialState: row.tutorial_state ?? {},
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Effective hard end accounts for any admin-granted extension days on top
// of the original 14-calendar-day window.
function effectiveHardEnd(membership: BetaMembership): Date {
  const base = new Date(membership.hardEndAt);
  if (membership.extendedDays > 0) {
    base.setDate(base.getDate() + membership.extendedDays);
  }
  return base;
}

export async function getBetaMembership(userId: string): Promise<BetaMembership | null> {
  const client = await getBetaServiceClient();
  if (!client) return null;

  const { data, error } = await client.from("beta_memberships").select("*").eq("user_id", userId).maybeSingle();

  if (error || !data) return null;
  return mapRow(data as MembershipRow);
}

export async function getBetaAccess(userId: string): Promise<BetaAccess> {
  const membership = await getBetaMembership(userId);
  if (!membership) return { active: false, reason: "no_membership" };
  if (membership.status === "revoked") return { active: false, reason: "revoked" };

  const now = new Date();
  const hardEnd = effectiveHardEnd(membership);
  const daysUsedExceeded = membership.activeDaysUsed >= BETA_ACTIVE_DAYS_LIMIT;
  const calendarExceeded = now >= hardEnd;

  if (membership.status === "expired" || daysUsedExceeded || calendarExceeded) {
    // Lazily transition active -> expired on read, since there's no
    // scheduled job infrastructure in this project. Only writes if it
    // wasn't already marked expired.
    if (membership.status === "active") {
      const client = await getBetaServiceClient();
      if (client) {
        await client
          .from("beta_memberships")
          .update({ status: "expired", expired_at: now.toISOString() })
          .eq("id", membership.id)
          .eq("status", "active"); // avoid clobbering a concurrent admin revoke
      }
    }
    return { active: false, reason: "expired" };
  }

  const daysRemainingActive = Math.max(0, BETA_ACTIVE_DAYS_LIMIT - membership.activeDaysUsed);
  const daysRemainingCalendar = Math.max(0, Math.ceil((hardEnd.getTime() - now.getTime()) / 86_400_000));

  return { active: true, membership, daysRemainingActive, daysRemainingCalendar };
}

export async function hasActiveBetaMembership(userId: string): Promise<boolean> {
  const access = await getBetaAccess(userId);
  return access.active;
}

// Records an active usage day for this membership. Idempotent per calendar
// date in the membership's timezone — call this AFTER a qualifying action
// succeeds (standard search, deep search, AI outreach, AI follow-up), never
// on login, settings, tutorial replay, or viewing an existing lead.
export async function recordBetaActiveDay(membershipId: string, timezone: string = BETA_TIMEZONE): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.rpc("record_beta_active_day", { p_membership_id: membershipId, p_timezone: timezone });
}
