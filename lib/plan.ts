// lib/plan.ts
// Subscription tier resolution for feature gating.
// During beta, NEXT_PUBLIC_BETA_PLAN controls the effective tier for all users.
// NEXT_PUBLIC_ vars are inlined at build time so they work on both client and server.

export type PlanTier = "scout" | "operator" | "agency";

export function getEffectivePlan(): PlanTier {
  // NEXT_PUBLIC_ vars are replaced at build time — always available client + server.
  const betaPlan = process.env.NEXT_PUBLIC_BETA_PLAN as PlanTier | undefined;
  if (betaPlan === "scout" || betaPlan === "operator" || betaPlan === "agency") {
    return betaPlan;
  }
  // Default: treat all beta users as Operator (full access)
  return "operator";
}

export function canUseDeepEnrichment(plan: PlanTier): boolean {
  return plan === "operator" || plan === "agency";
}

export function deepEnrichmentLimit(plan: PlanTier): number | null {
  if (plan === "agency") return null;     // unlimited
  if (plan === "operator") return 50;     // 50/month
  return 0;                               // scout — no access
}