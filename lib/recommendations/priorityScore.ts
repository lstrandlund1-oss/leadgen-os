// lib/recommendations/priorityScore.ts
//
// Deterministic priority scoring for "what should I work on today" — the
// core of the Home experience (Week 2 of the rebuild). Deliberately not
// AI-based: the rebuild spec is explicit that the recommendation
// algorithm should stay deterministic and honestly represented as such,
// not dressed up as something it isn't.
//
// Kept as a pure function, separate from the data-fetching in
// recommendations.ts, specifically so the formula itself can be tested
// directly without needing a live database.

export type PriorityInput = {
  opportunityValue: number; // 0-100, from company_intelligence's cached score
  isContacted: boolean;
  isReplied: boolean;
  isClosed: boolean;
  followupOverdue: boolean; // followup_date has passed and not yet closed
  daysSinceScored: number; // recency of the underlying company_intelligence snapshot
};

// Weights are deliberately simple and documented, not tuned against real
// outcome data yet — there isn't any yet. This is the honest, legible
// starting point the spec asks for; once real contacted->replied->won
// history exists, these should be recalibrated against what actually
// converts, not left as an arbitrary permanent formula.
const WEIGHTS = {
  baseOpportunity: 1.0,
  followupOverdueBonus: 15,
  freshUncontactedBonus: 10,
  recencyDecayPerDay: 0.5, // small penalty for staleness, capped below
  maxRecencyPenalty: 20,
};

export function computePriorityScore(input: PriorityInput): number {
  // Closed opportunities (won or lost) are done — never worth recommending
  // again today, regardless of how high their original score was.
  if (input.isClosed) return -Infinity;

  let score = input.opportunityValue * WEIGHTS.baseOpportunity;

  // A follow-up that's overdue is time-sensitive in a way a fresh,
  // never-contacted opportunity isn't — surfaced above raw score alone.
  if (input.followupOverdue) {
    score += WEIGHTS.followupOverdueBonus;
  }

  // A high-scoring company nobody has reached out to yet is exactly what
  // "today's work" should prioritize — small nudge above an equally-scored
  // one that's already been contacted and is just sitting, unresolved.
  if (!input.isContacted && !input.isReplied) {
    score += WEIGHTS.freshUncontactedBonus;
  }

  // Small recency decay — a company scored 60 days ago is more likely to
  // have changed (new competitor, website redesign, closed down) than one
  // scored yesterday. Capped so this never dominates the actual
  // opportunity value.
  const recencyPenalty = Math.min(input.daysSinceScored * WEIGHTS.recencyDecayPerDay, WEIGHTS.maxRecencyPenalty);
  score -= recencyPenalty;

  return score;
}
