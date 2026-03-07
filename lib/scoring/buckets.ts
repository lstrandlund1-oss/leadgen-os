// lib/scoring/buckets.ts
export type OpportunityBucket = "0-20" | "20-40" | "40-60" | "60-80" | "80-100";

export function bucketOpportunity(score0to100: number): OpportunityBucket {
  const s = Math.max(0, Math.min(100, score0to100));
  if (s < 20) return "0-20";
  if (s < 40) return "20-40";
  if (s < 60) return "40-60";
  if (s < 80) return "60-80";
  return "80-100";
}