// lib/beta/gate.ts
// Shared entry point for gating a metered AI action. Each of the three AI
// routes (generate-outreach, sequences, discover's deep-search path) calls
// this first: if the user has active beta membership, it reserves usage
// against their beta allowance and the route must NOT also apply the
// existing plan-based limit. If the user isn't a beta member, the route
// falls through to its existing plan-based gating exactly as before —
// this module changes nothing about non-beta behavior.

import crypto from "crypto";
import { getBetaAccess, recordBetaActiveDay } from "./access";
import { reserveBetaUsage, commitBetaUsage, releaseBetaUsage } from "./usage";
import type { BetaFeature, BetaMembership } from "./types";

export type BetaGateResult =
  | { mode: "not_beta" }
  | { mode: "beta_blocked"; reason: string }
  | { mode: "beta_allowed"; usageId: number; membership: BetaMembership };

export async function beginBetaGatedAction(
  userId: string,
  feature: BetaFeature,
  estimatedCostMicroUsd: number = 0,
  idempotencyKey?: string,
): Promise<BetaGateResult> {
  const access = await getBetaAccess(userId);
  if (!access.active) return { mode: "not_beta" };

  const reservation = await reserveBetaUsage(
    access.membership,
    feature,
    idempotencyKey ?? crypto.randomUUID(),
    estimatedCostMicroUsd,
  );

  if (!reservation.allowed || reservation.usageId === null) {
    return { mode: "beta_blocked", reason: reservation.reason };
  }

  return { mode: "beta_allowed", usageId: reservation.usageId, membership: access.membership };
}

// Call after the AI action succeeds.
export async function finishBetaGatedAction(gate: BetaGateResult, realCostMicroUsd?: number): Promise<void> {
  if (gate.mode !== "beta_allowed") return;
  await commitBetaUsage(gate.usageId, realCostMicroUsd);
  // Standard search/deep search/outreach/follow-up are all qualifying
  // active-day actions — this call is idempotent per calendar day.
  await recordBetaActiveDay(gate.membership.id);
}

// Call if the AI action failed, so the reservation doesn't count against
// the tester's limits.
export async function abortBetaGatedAction(gate: BetaGateResult): Promise<void> {
  if (gate.mode !== "beta_allowed") return;
  await releaseBetaUsage(gate.usageId);
}

export function betaBlockedResponseBody(reason: string): { error: string; code: string } {
  const messages: Record<string, string> = {
    daily_limit: "You've reached today's usage limit for this beta feature. It resets tomorrow.",
    total_limit: "You've reached your total beta allowance for this feature.",
    monetary_ceiling: "You've reached the usage ceiling for your beta account. Contact us if you'd like to continue.",
  };
  return { error: messages[reason] ?? "Beta usage limit reached.", code: `BETA_${reason.toUpperCase()}` };
}
