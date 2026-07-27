// app/api/support-chat/route.ts
//
// Two endpoints:
//   POST /api/support-chat         — send a message, get AI reply
//   POST /api/support-chat/submit  — save resolved ticket + (TODO) email notify

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabaseServer";
import { rateLimitDb } from "@/lib/rateLimitDb";
import { logEvent } from "@/lib/analytics/log";
import { computeRealCostMicroUsd } from "@/lib/ai/cost";
import { isAiGenerationEnabled, AI_DISABLED_RESPONSE } from "@/lib/killSwitch";

function getCallerId(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "dev";
}

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const SYSTEM_PROMPT = `You are the LeadGenOS support assistant. LeadGenOS is a B2B lead intelligence tool that:
- Finds local businesses and scores them against a user's service profile
- Provides opportunity scores, risk flags, gap types, fit scores
- Has a deep scan feature that inspects a lead's website
- Lets users save leads and generate AI outreach messages
- Has three plans: Scout (free, limited), Operator (50 deep scans/month), Agency (unlimited)

Your job is to:
1. Quickly understand what the user's problem or question is
2. Ask ONE clarifying question at a time if needed to narrow it down
3. Provide a clear, concise answer or workaround when you can
4. If it's a bug or something you can't resolve, summarise the issue clearly so the support team can act fast
5. Be warm but efficient — users want answers, not essays

Keep responses SHORT (2–4 sentences max unless explaining steps). Never make up features that don't exist.
When you've fully understood the issue and either resolved it or determined it needs human review, end your message with exactly: [RESOLVED] or [NEEDS_HUMAN]`;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      userContext?: {
        plan?: string;
        businessName?: string;
        email?: string;
      };
    };

    if (!ANTHROPIC_KEY) {
      return NextResponse.json({ error: "Support chat not configured" }, { status: 500 });
    }

    if (!(await isAiGenerationEnabled())) {
      return NextResponse.json(AI_DISABLED_RESPONSE, { status: 503 });
    }

    // This endpoint is intentionally public (rendered globally in
    // app/layout.tsx, available to pre-signup visitors) — so auth can't
    // gate it, but it was previously completely unmetered: no rate limit,
    // no cost tracking, callable by anyone in an unbounded loop. Rate
    // limit by IP instead; generous enough for a real extended
    // conversation, tight enough to block scripted abuse.
    const caller = getCallerId(request);
    const limited = await rateLimitDb({ key: `support-chat:${caller}`, limit: 20, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many requests — please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
      );
    }

    const contextNote = body.userContext
      ? `\n\nUser context: plan=${body.userContext.plan ?? "unknown"}, business=${body.userContext.businessName ?? "unknown"}, email=${body.userContext.email ?? "not logged in"}`
      : "";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: SYSTEM_PROMPT + contextNote,
        messages: body.messages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Anthropic support chat error:", err);
      return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    }

    const data = (await res.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";

    const authUser = await getAuthUser();
    const costMicroUsd = computeRealCostMicroUsd(
      data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } : undefined,
    );
    await logEvent(authUser?.id ?? null, "support_chat_message", { costMicroUsd: costMicroUsd ?? 0 });

    const resolved = text.includes("[RESOLVED]");
    const needsHuman = text.includes("[NEEDS_HUMAN]");
    const clean = text.replace(/\[(RESOLVED|NEEDS_HUMAN)\]/g, "").trim();

    return NextResponse.json({ reply: clean, resolved, needsHuman });
  } catch (err) {
    console.error("support-chat POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Called when chat ends — saves ticket to Supabase
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      messages: { role: "user" | "assistant"; content: string }[];
      status: "resolved" | "needs_human";
      userEmail?: string;
      userPlan?: string;
      businessName?: string;
      summary?: string;
    };

    const user = await getAuthUser().catch(() => null);

    // Build a plain-text summary of the conversation
    const transcript = body.messages.map((m) => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`).join("\n");

    const ticketData = {
      user_id: user?.id ?? null,
      user_email: body.userEmail ?? user?.email ?? null,
      user_plan: body.userPlan ?? null,
      business_name: body.businessName ?? null,
      summary: body.summary ?? body.messages.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "",
      transcript,
      status: body.status,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("support_tickets").insert(ticketData);
    if (error) console.error("support_tickets insert error:", error);

    // TODO: Send email notification when Resend/Postmark is configured
    // await sendEmail({
    //   to: process.env.SUPPORT_EMAIL ?? "support@leadgenos.com",
    //   subject: `[LeadGenOS Support] ${body.status === "needs_human" ? "🔴 Needs Review" : "✅ Resolved"} — ${body.userEmail ?? "Anonymous"}`,
    //   text: `Status: ${body.status}\nUser: ${body.userEmail ?? "unknown"} (${body.userPlan ?? "unknown plan"})\nBusiness: ${body.businessName ?? "unknown"}\n\nTranscript:\n${transcript}`,
    // });
    console.log(
      `[SUPPORT TICKET] status=${body.status} user=${body.userEmail ?? "anon"} plan=${body.userPlan ?? "?"}\nSummary: ${ticketData.summary}`,
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("support-chat PUT error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
