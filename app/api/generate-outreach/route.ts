// app/api/generate-outreach/route.ts
// Three-stage outreach pipeline orchestrator.
//
// Stage A: buildStrategyBrief()  — deterministic, signal → brief
// Stage B: generateMessage()     — AI generation from brief (structured prompt)
// Stage C: humanizeMessage()     — AI rewrite for naturalness and brevity
//
// The API key never leaves the server.
// The user profile is injected server-side from the session.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { buildStrategyBrief } from "@/lib/outreach/strategyBrief";
import { generateMessage } from "@/lib/outreach/generateMessage";
import { humanizeMessage } from "@/lib/outreach/humanizeMessage";
import type { OutreachRequest, OutreachResult } from "@/lib/outreach/types";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as OutreachRequest;

    if (!body.company_name) {
      return NextResponse.json(
        { error: "company_name is required" },
        { status: 400 },
      );
    }

    // Inject user profile server-side
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("profile_data")
      .eq("user_id", user.id)
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

    // ── Stage B: AI generation ────────────────────────────────────────────
    const draft = await generateMessage(brief, apiKey);

    // ── Stage C: AI humanization ──────────────────────────────────────────
    const message = await humanizeMessage(draft, brief, apiKey);

    const result: OutreachResult = {
      brief,
      message,
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("/api/generate-outreach error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}