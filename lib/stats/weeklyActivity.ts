// lib/stats/weeklyActivity.ts
//
// Weekly activity trend — ported from the old Analytics page
// (app/profile/AnalyticsPage.tsx), which is being merged into Stats.
// Powers both "Activity Over Time" and "Close Rate Over Time" — both
// sections read from the same weekly points, just visualize different
// fields from them.

export type OutcomeForWeeklyActivity = {
  created_at: string;
  contacted: boolean;
  replied: boolean;
  booked_call: boolean;
  closed: boolean;
};

export type WeeklyPoint = {
  week: string; // "2026-W14"
  contacted: number;
  replied: number;
  booked: number;
  closed: number;
  replyRate: number;
  closeRate: number;
};

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function getWeekLabel(key: string): string {
  const [, w] = key.split("-W");
  return `W${w}`;
}

export function computeWeeklyActivity(outcomes: OutcomeForWeeklyActivity[]): WeeklyPoint[] {
  const weeklyMap = new Map<string, Omit<WeeklyPoint, "replyRate" | "closeRate">>();
  for (const o of outcomes) {
    const week = getWeekKey(o.created_at);
    const existing = weeklyMap.get(week) ?? { week, contacted: 0, replied: 0, booked: 0, closed: 0 };
    weeklyMap.set(week, {
      ...existing,
      contacted: existing.contacted + (o.contacted ? 1 : 0),
      replied: existing.replied + (o.replied ? 1 : 0),
      booked: existing.booked + (o.booked_call ? 1 : 0),
      closed: existing.closed + (o.closed ? 1 : 0),
    });
  }
  return Array.from(weeklyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      ...v,
      replyRate: pct(v.replied, v.contacted),
      closeRate: pct(v.closed, v.contacted),
    }));
}

// The week with the highest reply rate, among weeks that actually had
// contact activity — a week with 0 contacts can't meaningfully "win."
export function bestReplyWeek(weeklyData: WeeklyPoint[]): WeeklyPoint | null {
  return weeklyData.reduce<WeeklyPoint | null>((best, w) => {
    if (w.contacted === 0) return best;
    if (!best) return w;
    return w.replyRate > best.replyRate ? w : best;
  }, null);
}
