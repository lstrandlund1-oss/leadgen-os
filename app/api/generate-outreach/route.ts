// app/api/generate-outreach/route.ts
//
// Server-side proxy for Anthropic message generation.
// Keeps the API key off the client.

import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { prompt: string };

    if (!body.prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [{ role: "user", content: body.prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      let errMsg = "Anthropic API error";
      try { errMsg = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errMsg; } catch { /* ignore */ }
      return NextResponse.json({ error: errMsg, detail: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("/api/generate-outreach error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}