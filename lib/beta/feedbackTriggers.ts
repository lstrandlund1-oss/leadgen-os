// lib/beta/feedbackTriggers.ts
// Defines when each feature becomes eligible for an automatic feedback
// prompt. A feature is eligible once ANY of its trigger conditions is met
// (e.g. outreach: 3 generated OR 1 copied — either satisfies it).
//
// Event names referenced here must be logged via lib/analytics/log.ts at
// the actual point of completion in the app (never on page load, never
// mid-action) — see the wiring notes in the phase summary for which of
// these are already wired vs. still need a call site added.

export type FeedbackFeatureKey =
  | "search"
  | "deep_search"
  | "lead_scoring"
  | "outreach"
  | "followup"
  | "outcomes"
  | "tutorial";

export const FEEDBACK_FEATURE_VERSION: Record<FeedbackFeatureKey, string> = {
  search: "v1",
  deep_search: "v1",
  lead_scoring: "v1",
  outreach: "v1",
  followup: "v1",
  outcomes: "v1",
  tutorial: "v1",
};

export const FEEDBACK_TRIGGERS: Record<FeedbackFeatureKey, { event: string; threshold: number }[]> = {
  search: [{ event: "search_completed", threshold: 2 }],
  deep_search: [{ event: "deep_search_completed", threshold: 1 }],
  lead_scoring: [{ event: "lead_detail_viewed", threshold: 5 }],
  outreach: [
    { event: "outreach_generated", threshold: 3 },
    { event: "outreach_copied", threshold: 1 },
  ],
  followup: [{ event: "followup_completed", threshold: 1 }],
  outcomes: [{ event: "outcome_recorded", threshold: 1 }],
  tutorial: [{ event: "tutorial_finished", threshold: 1 }],
};

export type RatingReasonKey =
  // 1-2 stars
  | "confusing"
  | "inaccurate"
  | "too_slow"
  | "too_limited"
  | "did_not_solve_need"
  // 3 stars
  | "partly_useful"
  | "missing_information"
  | "required_too_much_editing"
  | "unsure_i_trust_it"
  // 4-5 stars
  | "easy_to_use"
  | "accurate"
  | "saved_time"
  | "changed_my_decision"
  | "ready_to_use";

export function reasonKeysForRating(rating: number): RatingReasonKey[] {
  if (rating <= 2) return ["confusing", "inaccurate", "too_slow", "too_limited", "did_not_solve_need"];
  if (rating === 3) return ["partly_useful", "missing_information", "required_too_much_editing", "unsure_i_trust_it"];
  return ["easy_to_use", "accurate", "saved_time", "changed_my_decision", "ready_to_use"];
}
