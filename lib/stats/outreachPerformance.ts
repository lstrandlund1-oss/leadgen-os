// lib/stats/outreachPerformance.ts
//
// Tonality Performance and Angle Performance — ported from the old
// Analytics page (app/profile/AnalyticsPage.tsx), which is being merged
// into Stats. Same formulas, extracted as pure functions instead of
// inline in a component, so they're directly testable.

export type OutcomeForPerformance = {
  contacted: boolean;
  replied: boolean;
  closed: boolean;
  tonality: "soft" | "direct" | "consultative" | "bold" | null;
  angle_type: string | null;
};

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

export type TonalityKey = "soft" | "consultative" | "direct" | "bold";

export const TONALITIES: { key: TonalityKey; label: string; color: string }[] = [
  { key: "soft", label: "Soft", color: "#8b5cf6" },
  { key: "consultative", label: "Consultative", color: "#3b82f6" },
  { key: "direct", label: "Direct", color: "#c9a84c" },
  { key: "bold", label: "Bold", color: "#f97316" },
];

export type TonalityStat = {
  key: TonalityKey;
  label: string;
  color: string;
  contacted: number;
  replied: number;
  closed: number;
  replyRate: number;
  closeRate: number;
};

export function computeTonalityPerformance(outcomes: OutcomeForPerformance[]): TonalityStat[] {
  return TONALITIES.map(({ key, label, color }) => {
    const rows = outcomes.filter((o) => o.tonality === key);
    const c = rows.filter((o) => o.contacted).length;
    const r = rows.filter((o) => o.replied).length;
    const cl = rows.filter((o) => o.closed).length;
    return { key, label, color, contacted: c, replied: r, closed: cl, replyRate: pct(r, c), closeRate: pct(cl, c) };
  });
}

// Only tonalities that were actually used at least once — an unused
// tonality showing "0% reply rate" would misleadingly look like a real,
// bad result rather than simply never having been tried.
export function bestTonality(stats: TonalityStat[]): TonalityStat | null {
  const withData = stats.filter((t) => t.contacted > 0);
  if (withData.length <= 1) return null;
  return withData.reduce((best, t) => (t.replyRate > best.replyRate ? t : best));
}

export type AngleStat = {
  name: string;
  contacted: number;
  replied: number;
  closed: number;
  replyRate: number;
};

export function computeAnglePerformance(outcomes: OutcomeForPerformance[]): AngleStat[] {
  const angleMap = new Map<string, { contacted: number; replied: number; closed: number }>();
  for (const o of outcomes) {
    const key = o.angle_type ?? "Unknown";
    const existing = angleMap.get(key) ?? { contacted: 0, replied: 0, closed: 0 };
    angleMap.set(key, {
      contacted: existing.contacted + (o.contacted ? 1 : 0),
      replied: existing.replied + (o.replied ? 1 : 0),
      closed: existing.closed + (o.closed ? 1 : 0),
    });
  }
  return Array.from(angleMap.entries())
    .map(([name, stats]) => ({ name, ...stats, replyRate: pct(stats.replied, stats.contacted) }))
    .sort((a, b) => b.replyRate - a.replyRate);
}
