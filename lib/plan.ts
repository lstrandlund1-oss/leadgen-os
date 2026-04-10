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
  if (plan === "agency") return null; // unlimited
  if (plan === "operator") return 50; // 50/month
  return 0; // scout — no access
}

export function canUseOutreach(plan: PlanTier): boolean {
  return plan === "operator" || plan === "agency";
}

// Beta pricing tiers (locked in for 12 months from signup)
export const BETA_PRICING: Record<PlanTier, { monthly: number; label: string }> = {
  scout: { monthly: 29, label: "Scout Beta" },
  operator: { monthly: 79, label: "Operator Beta" },
  agency: { monthly: 199, label: "Agency Beta" },
};

// Full release pricing (after beta period)
export const RELEASE_PRICING: Record<PlanTier, { monthly: number; label: string }> = {
  scout: { monthly: 49, label: "Scout" },
  operator: { monthly: 129, label: "Operator" },
  agency: { monthly: 349, label: "Agency" },
};

export function isBetaUser(betaJoinDate?: string | null): boolean {
  if (!betaJoinDate) return false;
  // Beta pricing locked for 12 months from join date
  const joined = new Date(betaJoinDate);
  const expires = new Date(joined);
  expires.setFullYear(expires.getFullYear() + 1);
  return new Date() < expires;
}

// ── Outreach + Sequence usage cap ────────────────────────────────────────────
// Counts both outreach messages AND sequence generations against a single
// monthly limit — they share the same Anthropic credits pool.

export function outreachLimit(plan: PlanTier): number | null {
  if (plan === "agency") return null; // unlimited
  if (plan === "operator") return 200; // 200 messages/month
  return 20; // scout — 20/month
}

export function canUseOutreachFeature(plan: PlanTier): boolean {
  return true; // all tiers can use outreach (subject to limit)
}
export function canUseDeepSearch(plan: PlanTier): boolean {
  return plan === "operator" || plan === "agency";
}

export function deepSearchLimit(plan: PlanTier): number | null {
  if (plan === "agency") return null; // unlimited
  if (plan === "operator") return 10; // 10 deep searches/month
  return 0; // scout — standard only
}
