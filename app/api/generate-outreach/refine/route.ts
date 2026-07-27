// app/api/generate-outreach/refine/route.ts
// One-click refinement endpoint — Stage C only, no full regeneration.
// Takes the current message + a specific instruction and rewrites it.

import { NextResponse } from "next/server";
import { isAiGenerationEnabled, AI_DISABLED_RESPONSE } from "@/lib/killSwitch";

export async function POST(request: Request) {
  try {
    if (!(await isAiGenerationEnabled())) {
      return NextResponse.json(AI_DISABLED_RESPONSE, { status: 503 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    const body = (await request.json()) as {
      current_message: string;
      instruction: string;
      channel: string;
      max_words: number;
      language: string;
    };

    const lang = body.language === "sv" ? "Swedish" : "English";
    const hasSubject = body.current_message.startsWith("Subject:");

    const systemPrompt = `You are an expert editor rewriting a cold outreach message in ${lang}.
Apply the instruction exactly. Preserve all specific details about the lead and their situation.
Keep the message under ${body.max_words} words in the body.
${hasSubject ? 'Output subject line first (starting with "Subject: "), blank line, then body.' : "Output body only."}
No preamble, no explanation — just the rewritten message.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Instruction: ${body.instruction}\n\nCurrent message:\n---\n${body.current_message}\n---\n\nRewrite it now.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: "Refinement failed" }, { status: res.status });
    }

    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    const rawText = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let subject: string | undefined;
    let bodyText = rawText;

    if (hasSubject && rawText.startsWith("Subject:")) {
      const lines = rawText.split("\n");
      subject = lines[0].replace(/^Subject:\s*/i, "").trim();
      bodyText = lines
        .slice(lines[1]?.trim() === "" ? 2 : 1)
        .join("\n")
        .trim();
    }

    const word_count = bodyText.split(/\s+/).filter(Boolean).length;
    return NextResponse.json({ subject, body: bodyText, word_count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
