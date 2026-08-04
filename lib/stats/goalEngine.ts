// lib/stats/goalEngine.ts
//
// Suggested monthly goal, computed entirely from the user's own
// historical performance — never a default, template, or invented
// number. If there's no prior closed-deal history, there's nothing
// honest to base a suggestion on, so this returns null rather than
// picking an arbitrary starting goal.

export type MonthlyWinCount = { month: string; wins: number };

export type SuggestedGoal = {
  targetWins: number;
  basedOnMonths: number;
};

// A goal equal to your exact historical average isn't really a "goal" —
// it's just restating the past. A modest stretch above your own average
// is the most defensible non-arbitrary choice available without
// fabricating a target from nothing.
const STRETCH_FACTOR = 1.15;

export function computeSuggestedGoal(history: MonthlyWinCount[]): SuggestedGoal | null {
  if (history.length === 0) return null;

  const totalWins = history.reduce((sum, m) => sum + m.wins, 0);
  if (totalWins === 0) return null;

  const average = totalWins / history.length;
  // Math.ceil, not Math.round — a "stretch" goal that rounds back down
  // to the exact historical average isn't actually a stretch. Floor+1
  // guarantees a genuine integer increase even when the stretch factor
  // alone would round back down to the same whole number.
  const targetWins = Math.max(Math.floor(average) + 1, Math.ceil(average * STRETCH_FACTOR));

  return { targetWins, basedOnMonths: history.length };
}
