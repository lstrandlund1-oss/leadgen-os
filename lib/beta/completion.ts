// lib/beta/completion.ts
// Beta completion criteria, discount eligibility, and the admin actions
// (expire, extend, mark interview complete) that feed into them.

import { getBetaServiceClient } from "./serviceClient";
import { BETA_COMPLETION_MIN_ACTIVE_DAYS, BETA_DISCOUNT_PERCENT, BETA_DISCOUNT_MONTHS } from "./config";

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
}

// Extension is auditable (who granted it, when) and must NOT reset usage
// counters — it only ever adds days to extended_days, never touches
// active_days_used or any beta_usage row.
export async function adminGrantExtension(membershipId: string, adminEmail: string, days: number): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const { data: existing } = await client
    .from("beta_memberships")
    .select("extended_days")
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
}

export async function adminMarkInterviewCompleted(membershipId: string, userId: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client
    .from("beta_memberships")
    .update({ final_interview_completed: true, final_interview_completed_at: new Date().toISOString() })
    .eq("id", membershipId);
  await checkAndAwardDiscount(membershipId, userId);
}
