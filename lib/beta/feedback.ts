// lib/beta/feedback.ts
import { getBetaServiceClient } from "./serviceClient";
import { countEvents, logEvent } from "@/lib/analytics/log";
import { FEEDBACK_TRIGGERS, FEEDBACK_FEATURE_VERSION, type FeedbackFeatureKey } from "./feedbackTriggers";
import { checkAndUpdateRequiredFeedback } from "./completion";

export type FeatureFeedbackInput = {
  rating: number | null; // null when notUsedEnough is true
  notUsedEnough: boolean;
  reasonKey: string | null;
  freeText: string | null;
};

// Upsert semantics: submitting again for the same feature+version (a
// voluntary re-rate from Settings) updates the existing row rather than
// erroring on the unique constraint or creating a duplicate.
export async function submitFeatureFeedback(
  membershipId: string,
  userId: string,
  featureKey: FeedbackFeatureKey,
  input: FeatureFeedbackInput,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const version = FEEDBACK_FEATURE_VERSION[featureKey];
  const { data: existing } = await client
    .from("beta_feature_feedback")
    .select("id")
    .eq("membership_id", membershipId)
    .eq("feature_key", featureKey)
    .eq("feature_version", version)
    .maybeSingle();

  const row = {
    membership_id: membershipId,
    user_id: userId,
    feature_key: featureKey,
    feature_version: version,
    rating: input.rating,
    not_used_enough: input.notUsedEnough,
    reason_key: input.reasonKey,
    free_text: input.freeText,
  };

  if (existing) {
    await client.from("beta_feature_feedback").update(row).eq("id", existing.id);
  } else {
    await client.from("beta_feature_feedback").insert(row);
  }

  await checkAndUpdateRequiredFeedback(membershipId);
  await logEvent(userId, "feature_feedback_submitted", {
    featureKey,
    rating: input.rating,
    notUsedEnough: input.notUsedEnough,
  });
}

export async function submitLeadFeedback(
  membershipId: string,
  userId: string,
  leadId: string,
  runId: number | null,
  accurate: boolean | null,
  comment: string | null,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.from("beta_lead_feedback").insert({
    membership_id: membershipId,
    user_id: userId,
    lead_id: leadId,
    run_id: runId,
    accurate,
    comment,
  });
  await logEvent(userId, "lead_feedback_submitted", { leadId, accurate });
}

export async function getRatedFeatures(membershipId: string): Promise<Set<string>> {
  const client = await getBetaServiceClient();
  if (!client) return new Set();
  const { data } = await client
    .from("beta_feature_feedback")
    .select("feature_key, feature_version")
    .eq("membership_id", membershipId);
  return new Set((data ?? []).map((r) => `${r.feature_key}:${r.feature_version}`));
}

// Returns the first feature that has both (a) met its usage threshold and
// (b) not yet been rated at its current version — or null if none qualify.
// The caller (client) still applies the "at most one prompt per browser
// session" rule via sessionStorage before actually showing anything; this
// only answers "is there anything eligible right now."
export async function getEligibleFeedbackFeature(
  userId: string,
  membershipId: string,
): Promise<FeedbackFeatureKey | null> {
  const rated = await getRatedFeatures(membershipId);

  for (const featureKey of Object.keys(FEEDBACK_TRIGGERS) as FeedbackFeatureKey[]) {
    const version = FEEDBACK_FEATURE_VERSION[featureKey];
    if (rated.has(`${featureKey}:${version}`)) continue;

    const conditions = FEEDBACK_TRIGGERS[featureKey];
    for (const condition of conditions) {
      const count = await countEvents(userId, condition.event);
      if (count >= condition.threshold) return featureKey;
    }
  }
  return null;
}
