// app/api/generate-outreach/route.ts
//
// First-touch outreach message generator.
// Three-stage pipeline: deterministic brief → AI draft → AI humanise.
// Locked to first_touch objective — follow-up and re-engage are handled
// by the sequence generator which builds on this message as its anchor.
//
// Credit gating: shared outreach_usage table with sequence generator.
// Scout: 20/month  Operator: 200/month  Agency: unlimited

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
import { buildStrategyBrief } from "@/lib/outreach/strategyBrief";
import { generateMessage } from "@/lib/outreach/generateMessage";
import { humanizeMessage } from "@/lib/outreach/humanizeMessage";
import { getEffectivePlan, outreachLimit } from "@/lib/plan";
import {
  beginBetaGatedAction,
  finishBetaGatedAction,
  abortBetaGatedAction,
  betaBlockedResponseBody,
} from "@/lib/beta/gate";
import type { OutreachRequest, OutreachResult } from "@/lib/outreach/types";

async function checkAndLogOutreachUsage(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number | null;
}> {
  const plan = getEffectivePlan();
  const limit = outreachLimit(plan);
  if (limit === null) return { allowed: true, used: 0, limit: null };
  if (!supabase) return { allowed: true, used: 0, limit };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("outreach_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  const used = count ?? 0;
  if (used >= limit) return { allowed: false, used, limit };

  // Log usage (fire-and-forget)
  supabase
    .from("outreach_usage")
    .insert({ user_id: userId, type: "message" })
    .then(() => {});
  return { allowed: true, used, limit };
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    const authedSupabase = await createSupabaseServer();
    const {
      data: { user },
    } = await authedSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Beta members get their own metered allowance (see lib/beta/config.ts)
    // instead of the commercial outreachLimit check — core access is
    // operator-equivalent, only this AI action is capped for them.
    // ~$0.004 per message (2 Haiku calls) — no per-call cost is returned by
    // the generation pipeline, so this estimate is also used as the
    // committed cost; real token-level cost tracking is a future refinement.
    const ESTIMATED_COST_MICRO_USD = 4_000;
    const betaGate = await beginBetaGatedAction(user.id, "outreach", ESTIMATED_COST_MICRO_USD);

    if (betaGate.mode === "beta_blocked") {
      return NextResponse.json(betaBlockedResponseBody(betaGate.reason), { status: 429 });
    }

    let usage = { allowed: true, used: 0, limit: null as number | null };
    if (betaGate.mode === "not_beta") {
      // Not a beta member — existing commercial credit check, unchanged.
      usage = await checkAndLogOutreachUsage(user.id);
      if (!usage.allowed) {
        return NextResponse.json(
          {
            error: `Monthly outreach limit reached (${usage.limit} messages). Upgrade for more.`,
            code: "OUTREACH_LIMIT",
            used: usage.used,
            limit: usage.limit,
          },
          { status: 429 },
        );
      }
    }

    const body = (await request.json()) as OutreachRequest;
    if (!body.company_name) return NextResponse.json({ error: "company_name is required" }, { status: 400 });

    // Always first touch — sequence generator handles follow-up/re-engage
    body.objective = "first_touch";

    // Inject user profile server-side
    const { data: profileRow } = await authedSupabase
      .from("user_profiles")
      .select("profile_data")
      .eq("id", user.id)
      .single();

    const userProfile = profileRow?.profile_data ?? {};
    body.user_profile = {
      profileType: userProfile.profileType ?? null,
      businessName: userProfile.businessName ?? null,
      capabilities: userProfile.capabilities ?? {},
      acquisitionStyle: userProfile.acquisitionStyle ?? "balanced",
    };

    // ── Stage A: deterministic brief ──────────────────────────────────────
    const brief = buildStrategyBrief(body);

    let draft, message;
    try {
      // ── Stage B: AI generation ────────────────────────────────────────────
      draft = await generateMessage(brief, apiKey);

      // ── Stage C: AI humanization ──────────────────────────────────────────
      message = await humanizeMessage(draft, brief, apiKey);
    } catch (genErr) {
      // AI call failed — release the beta reservation so it doesn't count
      // against the tester's allowance. Commercial usage_usage logging
      // above is fire-and-forget and unaffected either way (pre-existing
      // behavior, unchanged).
      await abortBetaGatedAction(betaGate);
      throw genErr;
    }

    await finishBetaGatedAction(betaGate, ESTIMATED_COST_MICRO_USD);

    const result: OutreachResult = {
      brief,
      message,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json({
      ...result,
      usage: { used: usage.used + 1, limit: usage.limit },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("/api/generate-outreach error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
