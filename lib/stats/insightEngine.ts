// lib/stats/insightEngine.ts
//
// "Companies with X convert Y times better for you" — a real,
// personalized insight computed from the user's own outcome history, not
// a generic or fabricated claim. Correlates each detected-gap category
// with actual win rate, and surfaces the strongest genuine lift over
// baseline — or nothing at all, if there isn't enough closed-deal
// history yet. Matches the same pattern already used for economic
// impact and market coverage: an honest "no data yet" beats a number
// that looks confident but isn't.

export type ClosedLeadRecord = {
  gapType: string | null;
  gapMessage: string | null;
  won: boolean;
};

export type Insight = {
  gapType: string;
  gapMessage: string;
  liftMultiplier: number;
  sampleSize: number;
};

// Below this sample size for a given gap type, a computed win rate is
// too noisy to act on — a 3/4 win rate looks dramatic but could easily
// be luck. Deliberately conservative, not a rigorously derived
// statistical threshold.
const MIN_SAMPLE_SIZE = 5;
// Minimum genuine improvement over baseline before it's worth surfacing —
// a 1.05x "lift" isn't a real pattern worth calling out.
const MIN_LIFT_TO_SURFACE = 1.3;

export function computeBestInsight(closedLeads: ClosedLeadRecord[]): Insight | null {
  if (closedLeads.length === 0) return null;

  const overallWinRate = closedLeads.filter((l) => l.won).length / closedLeads.length;
  if (overallWinRate === 0) return null;

  const byGapType = new Map<string, { message: string; total: number; won: number }>();
  for (const lead of closedLeads) {
    if (!lead.gapType) continue;
    const existing = byGapType.get(lead.gapType) ?? { message: lead.gapMessage ?? lead.gapType, total: 0, won: 0 };
    existing.total += 1;
    if (lead.won) existing.won += 1;
    byGapType.set(lead.gapType, existing);
  }

  let best: Insight | null = null;
  for (const [gapType, stats] of byGapType) {
    if (stats.total < MIN_SAMPLE_SIZE) continue;
    const typeWinRate = stats.won / stats.total;
    const lift = typeWinRate / overallWinRate;
    if (lift < MIN_LIFT_TO_SURFACE) continue;
    if (!best || lift > best.liftMultiplier) {
      best = { gapType, gapMessage: stats.message, liftMultiplier: lift, sampleSize: stats.total };
    }
  }

  return best;
}
