// lib/ai/cost.ts
// Real per-call cost calculation from actual token usage, replacing the
// static estimates previously used everywhere. Verified current pricing
// (checked July 2026, confirmed across Anthropic's own pricing page and
// several independent trackers): Claude Haiku 4.5 is $1 per million input
// tokens, $5 per million output tokens — the model used by every AI
// generation call in this app (outreach, sequences, deep search query
// planning).
//
// If pricing changes, update these two constants — nothing else needs to
// change, since all cost calculation funnels through here.

const HAIKU_INPUT_MICRO_USD_PER_TOKEN = 1; // $1 / 1,000,000 tokens = 1 micro-USD/token
const HAIKU_OUTPUT_MICRO_USD_PER_TOKEN = 5; // $5 / 1,000,000 tokens = 5 micro-USD/token

export type TokenUsage = { inputTokens: number; outputTokens: number } | undefined;

function costForUsage(usage: TokenUsage): number | null {
  if (!usage) return null;
  return usage.inputTokens * HAIKU_INPUT_MICRO_USD_PER_TOKEN + usage.outputTokens * HAIKU_OUTPUT_MICRO_USD_PER_TOKEN;
}

// Sums real cost across however many generation stages a pipeline used
// (e.g. outreach = draft + humanize, 2 stages). Returns null if none of
// the stages returned usage data, so the caller can fall back to a static
// estimate rather than silently recording zero cost.
export function computeRealCostMicroUsd(...stages: TokenUsage[]): number | null {
  const costs = stages.map(costForUsage).filter((c): c is number => c !== null);
  if (costs.length === 0) return null;
  return costs.reduce((sum, c) => sum + c, 0);
}
