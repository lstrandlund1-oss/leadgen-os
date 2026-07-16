// app/api/leads/snapshot/route.ts
// Generates a plain-English AI summary of a lead using Claude Haiku.
// Tells the user: who this business is, what the gap is, why they're worth
// contacting, and what angle to lead with.
// Gated by the shared outreach_usage credit pool.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
import { getEffectivePlan, outreachLimit } from "@/lib/plan";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API not configured" }, { status: 500 });

    const authedSupabase = await createSupabaseServer();
    const {
      data: { user },
    } = await authedSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Credit check — shares outreach_usage pool
    const plan = getEffectivePlan();
    const limit = outreachLimit(plan);
    if (limit !== null && supabase) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("outreach_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString());
      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          {
            error: `Monthly limit reached (${limit} messages). Upgrade for more.`,
            code: "OUTREACH_LIMIT",
          },
          { status: 429 },
        );
      }
      supabase
        .from("outreach_usage")
        .insert({ user_id: user.id, type: "snapshot" })
        .then(() => {});
    }

    const body = (await request.json()) as {
      company_name: string;
      city?: string;
      industry?: string;
      rating?: number;
      review_count?: number;
      has_website?: boolean;
      social_presence?: string;
      opportunity?: number;
      risk?: number;
      fit_score?: number;
      gap_type?: string;
      gap_tooltip?: string;
      risk_profile?: string;
      matched_needs?: string[];
    };

    const gapLabels: Record<string, string> = {
      VISIBILITY: "Visibility Gap — they exist but aren't being found",
      CONVERSION: "Conversion Gap — interest leaks before becoming bookings",
      INFRASTRUCTURE: "Infrastructure Gap — no digital foundation",
      OPTIMIZATION: "Optimization Gap — strong base with room to sharpen",
    };

    const prompt = `You are a senior B2B sales analyst. Write a concise lead intelligence snapshot for a sales rep about to contact this business.

LEAD DATA:
- Business: ${body.company_name}${body.city ? `, ${body.city}` : ""}
- Industry: ${body.industry ?? "unknown"}
- Rating: ${body.rating ?? "unknown"} (${body.review_count ?? 0} reviews)
- Website: ${body.has_website ? "Yes" : "No"}
- Social presence: ${body.social_presence ?? "unknown"}
- Opportunity score: ${body.opportunity ?? 0}/100
- Risk score: ${body.risk ?? 0}/100
- Fit score: ${body.fit_score ?? 0}/100
- Gap type: ${body.gap_type ? (gapLabels[body.gap_type] ?? body.gap_type) : "unknown"}
${body.matched_needs?.length ? `- Matched needs: ${body.matched_needs.join(", ")}` : ""}
${body.gap_tooltip ? `- Gap detail: ${body.gap_tooltip}` : ""}

Write 3-4 sentences covering:
1. Who this business is and where they stand (reputation, presence)
2. The specific gap or opportunity detected
3. Why this makes them worth contacting right now
4. The best angle to lead with in outreach

Be direct and specific. No fluff. Write as if briefing a sales rep before a call. Do not use bullet points — write in flowing prose.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return NextResponse.json({ error: "AI request failed" }, { status: 500 });

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? []).find((b) => b.type === "text")?.text?.trim() ?? "";

    return NextResponse.json({ ok: true, snapshot: text });
  } catch (err) {
    console.error("[snapshot]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
