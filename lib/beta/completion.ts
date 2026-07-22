// lib/beta/completion.ts
// Beta completion criteria, discount eligibility, and the admin actions
// (expire, extend, mark interview complete) that feed into them.

import { getBetaServiceClient } from "./serviceClient";
import { BETA_COMPLETION_MIN_ACTIVE_DAYS, BETA_DISCOUNT_PERCENT, BETA_DISCOUNT_MONTHS } from "./config";
import { logAdminAction, logEvent } from "@/lib/analytics/log";
import type { BetaFeature } from "./types";

const REQUIRED_FEATURE_COUNT = 7; // search, deep_search, lead_scoring, outreach, followup, outcomes, tutorial

// Call after every feature feedback submission. Auto-computes whether the
// tester has now rated everything required — this flag is NOT admin-marked
// (unlike final_interview_completed, which the spec explicitly says an
// administrator marks). Queries beta_feature_feedback directly rather than
// importing from feedback.ts, to avoid a circular import between the two
// modules (feedback.ts calls this function after every submission).
export async function checkAndUpdateRequiredFeedback(membershipId: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const { data } = await client
    .from("beta_feature_feedback")
    .select("feature_key, feature_version")
    .eq("membership_id", membershipId);
  const distinctFeatures = new Set((data ?? []).map((r) => `${r.feature_key}:${r.feature_version}`));
  if (distinctFeatures.size < REQUIRED_FEATURE_COUNT) return;

  await client
    .from("beta_memberships")
    .update({ required_feedback_completed: true, required_feedback_completed_at: new Date().toISOString() })
    .eq("id", membershipId)
    .eq("required_feedback_completed", false); // don't stomp an existing timestamp on repeat calls
}

// Beta completion (distinct from expiration) requires all three:
// - at least 3 active usage days
// - final interview marked completed by an administrator
// - required feedback completed
// The discount must NOT depend on providing a testimonial — deliberately
// not checked here at all.
export async function checkBetaCompletion(membershipId: string): Promise<boolean> {
  const client = await getBetaServiceClient();
  if (!client) return false;

  const { data } = await client
    .from("beta_memberships")
    .select("active_days_used, final_interview_completed, required_feedback_completed")
    .eq("id", membershipId)
    .maybeSingle();

  if (!data) return false;
  return (
    data.active_days_used >= BETA_COMPLETION_MIN_ACTIVE_DAYS &&
    data.final_interview_completed === true &&
    data.required_feedback_completed === true
  );
}

// Awards the discount if completion criteria are met and no grant exists
// yet. redemption_deadline is left null — there's no official launch date
// yet, so no deadline can honestly be set (see migration 0004).
export async function checkAndAwardDiscount(membershipId: string, userId: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const completed = await checkBetaCompletion(membershipId);
  if (!completed) return;

  const { data: existing } = await client
    .from("beta_discount_grants")
    .select("id")
    .eq("membership_id", membershipId)
    .maybeSingle();
  if (existing) return; // already awarded

  await client.from("beta_discount_grants").insert({
    membership_id: membershipId,
    user_id: userId,
    source: "private_beta",
    percent: BETA_DISCOUNT_PERCENT,
    duration_months: BETA_DISCOUNT_MONTHS,
    redemption_deadline: null,
    status: "earned",
  });
  await logEvent(userId, "discount_earned", { membershipId, source: "automatic" });
}

export async function getDiscountGrant(membershipId: string) {
  const client = await getBetaServiceClient();
  if (!client) return null;
  const { data } = await client
    .from("beta_discount_grants")
    .select("*")
    .eq("membership_id", membershipId)
    .maybeSingle();
  return data;
}

// ── Admin domain actions ──────────────────────────────────────────────
// Underlying functions exist now per Phase 7; the actual admin UI buttons
// that call these are Phase 8 (protected internal dashboard).

export async function adminExpireMembership(membershipId: string, adminEmail: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_memberships")
    .update({
      status: "expired",
      expired_at: new Date().toISOString(),
      internal_notes: `Manually expired by ${adminEmail}`,
    })
    .eq("id", membershipId);
  await logAdminAction(adminEmail, "expire_membership", membershipId);
}

export async function adminRevokeMembership(membershipId: string, adminEmail: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_memberships")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", membershipId);
  await logAdminAction(adminEmail, "revoke_membership", membershipId);
}

// Extension is auditable (who granted it, when) and must NOT reset usage
// counters — it only ever adds days to extended_days, never touches
// active_days_used or any beta_usage row.
export async function adminGrantExtension(membershipId: string, adminEmail: string, days: number): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const { data: existing } = await client
    .from("beta_memberships")
    .select("extended_days, user_id")
    .eq("id", membershipId)
    .maybeSingle();
  const newExtendedDays = (existing?.extended_days ?? 0) + days;

  await client
    .from("beta_memberships")
    .update({
      extended_days: newExtendedDays,
      extension_granted_by: adminEmail,
      extension_granted_at: new Date().toISOString(),
      status: "active", // re-activate if it had already lapsed
    })
    .eq("id", membershipId);
  await logAdminAction(adminEmail, "grant_extension", membershipId, { days, newExtendedDays });
  if (existing?.user_id) await logEvent(existing.user_id, "beta_extended", { membershipId, days, newExtendedDays });
}

export async function adminMarkInterviewCompleted(
  membershipId: string,
  userId: string,
  adminEmail: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_memberships")
    .update({ final_interview_completed: true, final_interview_completed_at: new Date().toISOString() })
    .eq("id", membershipId);
  await logAdminAction(adminEmail, "mark_interview_completed", membershipId);
  await checkAndAwardDiscount(membershipId, userId);
}

// Manual override — the automatic path (checkAndUpdateRequiredFeedback)
// computes this from actual submitted ratings, but an admin can also mark
// it complete directly (e.g. a tester gave verbal feedback in the
// interview instead of using the in-app rating flow).
export async function adminMarkRequiredFeedbackCompleted(
  membershipId: string,
  userId: string,
  adminEmail: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_memberships")
    .update({ required_feedback_completed: true, required_feedback_completed_at: new Date().toISOString() })
    .eq("id", membershipId);
  await logAdminAction(adminEmail, "mark_required_feedback_completed", membershipId);
  await checkAndAwardDiscount(membershipId, userId);
}

export async function adminSetInternalNotes(membershipId: string, notes: string, adminEmail: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.from("beta_memberships").update({ internal_notes: notes }).eq("id", membershipId);
  await logAdminAction(adminEmail, "set_internal_notes", membershipId);
}

// Per-tester AI allowance override (Phase 8: "Adjust AI allowance").
// null values mean "use the global default from lib/beta/config.ts" for
// that specific limit.
export async function adminSetAllowanceOverride(
  membershipId: string,
  feature: BetaFeature,
  dailyLimit: number | null,
  totalLimit: number | null,
  adminEmail: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_feature_allowances")
    .upsert(
      {
        membership_id: membershipId,
        feature,
        daily_limit: dailyLimit,
        total_limit: totalLimit,
        updated_by: adminEmail,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "membership_id,feature" },
    );
  await logAdminAction(adminEmail, "set_allowance_override", membershipId, { feature, dailyLimit, totalLimit });
}

// Per-tester monetary ceiling override (Phase 8: "Adjust monetary
// ceiling"). null means "use the global default."
export async function adminSetMonetaryCeiling(
  membershipId: string,
  ceilingMicroUsd: number | null,
  adminEmail: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.from("beta_memberships").update({ monetary_ceiling_micro_usd: ceilingMicroUsd }).eq("id", membershipId);
  await logAdminAction(adminEmail, "set_monetary_ceiling", membershipId, { ceilingMicroUsd });
}

// Manual award, bypassing the automatic completion-criteria check — the
// spec lists "Award/inspect discount" as a direct admin action, distinct
// from the automatic award that fires when completion criteria are met.
export async function adminAwardDiscountManually(
  membershipId: string,
  userId: string,
  adminEmail: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const { data: existing } = await client
    .from("beta_discount_grants")
    .select("id")
    .eq("membership_id", membershipId)
    .maybeSingle();
  if (existing) return;

  await client.from("beta_discount_grants").insert({
    membership_id: membershipId,
    user_id: userId,
    source: "admin_manual_award",
    percent: BETA_DISCOUNT_PERCENT,
    duration_months: BETA_DISCOUNT_MONTHS,
    redemption_deadline: null,
    status: "earned",
  });
  await logAdminAction(adminEmail, "award_discount_manually", membershipId);
  await logEvent(userId, "discount_earned", { membershipId, source: "admin_manual" });
}

// Testimonial approval is a manual, admin-driven process — the operator
// personally asks a tester for a testimonial only when genuine value was
// demonstrated (per spec), then records the exact approved wording here.
// Deliberately does NOT log the quote text itself in the audit trail or
// analytics event, since that's tester-provided content, not operational
// metadata.
export async function adminApproveTestimonial(
  membershipId: string,
  userId: string,
  input: {
    quote: string;
    name: string | null;
    role: string | null;
    company: string | null;
    logoPermission: boolean;
    photoPermission: boolean;
    channels: string[];
  },
  adminEmail: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const { data: existing } = await client
    .from("beta_testimonials")
    .select("id")
    .eq("membership_id", membershipId)
    .maybeSingle();

  const row = {
    membership_id: membershipId,
    user_id: userId,
    approved_quote: input.quote,
    approved_name: input.name,
    approved_role: input.role,
    approved_company: input.company,
    logo_permission: input.logoPermission,
    photo_permission: input.photoPermission,
    permitted_channels: input.channels,
    status: "approved",
    approved_at: new Date().toISOString(),
  };

  if (existing) {
    await client.from("beta_testimonials").update(row).eq("id", existing.id);
  } else {
    await client.from("beta_testimonials").insert(row);
  }

  await logAdminAction(adminEmail, "approve_testimonial", membershipId);
  await logEvent(userId, "testimonial_approved", { membershipId });
}

export async function adminRevokeTestimonial(membershipId: string, adminEmail: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_testimonials")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("membership_id", membershipId);
  await logAdminAction(adminEmail, "revoke_testimonial", membershipId);
}

// Domain path for converting a beta account to paid, per Phase 7 — the
// function exists now even though real Stripe redemption remains a
// pending integration. Does not create a new profile or duplicate user;
// only marks the existing membership as converted.
export async function markBetaConverted(membershipId: string, userId: string, adminEmail: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_memberships")
    .update({ status: "converted", converted_at: new Date().toISOString() })
    .eq("id", membershipId);
  await logAdminAction(adminEmail, "mark_converted", membershipId);
  await logEvent(userId, "paid_conversion_completed", { membershipId });
}
