// lib/outreach/humanizeMessage.ts
// Stage C — Humanization Layer
//
// Purpose: rewrite the Stage B draft to eliminate AI phrasing,
// improve flow, enforce natural human tone, and ensure channel-appropriate brevity.
//
// This is a REWRITER, not a generator. It does not add new information.
// It only improves how existing content sounds.
//
// Key rules:
//   - Remove AI sentence patterns ("I wanted to reach out", "I hope this finds you well")
//   - Enforce channel word limits (hard ceiling)
//   - Improve rhythm — vary sentence length, cut filler
//   - Preserve all signal-grounded specifics (do not generalize back to vague)
//   - Match natural ${language} SaaS professional tone

import type { StrategyBrief, GeneratedDraft, HumanizedMessage } from "./types";

const AI_PHRASES_TO_AVOID = [
  "I wanted to reach out",
  "I hope this finds you well",
  "I hope you're doing well",
  "touch base",
  "circle back",
  "synergy",
  "leverage",
  "actionable",
  "game-changer",
  "cutting-edge",
  "streamline",
  "innovative solution",
  "value proposition",
  "I am writing to",
  "As an AI",
  "I'd like to",
  "I'm reaching out because",
  "Please don't hesitate",
  "Feel free to",
  "Best regards",
  "Kind regards",
  "I look forward to hearing from you",
];

function buildHumanizeSystemPrompt(brief: StrategyBrief): string {
  const lang = brief.language === "sv" ? "Swedish" : "English";
  const maxWords = brief.max_words;

  return `You are an expert editor specializing in making AI-generated sales messages sound like they were written by a smart, busy human professional.

Your ONLY job is to rewrite the provided message draft to:
1. Remove any AI-sounding phrases or patterns
2. Improve rhythm and flow (vary sentence length, remove filler words)
3. Keep it under ${maxWords} words in the body — cut ruthlessly if over
4. Preserve every signal-grounded specific detail (names, numbers, observations) — do not generalize
5. Make it sound like a real person typed it quickly and confidently

Language: ${lang}
Channel: ${brief.channel}

PHRASES TO REMOVE if present (replace or cut):
${AI_PHRASES_TO_AVOID.map((p) => `- "${p}"`).join("\n")}

TONE PROFILE: ${brief.tone}
${brief.tone === "consultative" ? "Advisory, thoughtful. Not a sales pitch. Peer-to-peer." : ""}
${brief.tone === "direct" ? "Confident, short. No hedging." : ""}
${brief.tone === "friendly" ? "Warm but professional. Not casual." : ""}
${brief.tone === "professional" ? "Polished, precise. Executive register." : ""}
${brief.tone === "bold" ? "Pattern-interrupt. Confident, slightly provocative. Not aggressive." : ""}

OUTPUT: Respond ONLY with the final message. No labels, no explanation, no "Here is the rewritten version:".
${brief.requires_subject ? 'Subject line first (starting with "Subject: "), then blank line, then body.' : "Body only."}`;
}

function buildHumanizeUserPrompt(draft: GeneratedDraft): string {
  const hasSubject = draft.subject !== undefined;

  return `Rewrite this message draft:

---
${hasSubject ? `Subject: ${draft.subject}\n\n` : ""}${draft.body}
---

Remember: preserve all specific details. Only improve how it sounds.`;
}

export async function humanizeMessage(
  draft: GeneratedDraft,
  brief: StrategyBrief,
  apiKey: string,
): Promise<HumanizedMessage> {
  const systemPrompt = buildHumanizeSystemPrompt(brief);
  const userPrompt = buildHumanizeUserPrompt(draft);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stage C humanization failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const rawText = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  // Parse subject
  let subject: string | undefined;
  let body = rawText;

  if (brief.requires_subject && rawText.startsWith("Subject:")) {
    const lines = rawText.split("\n");
    subject = lines[0].replace(/^Subject:\s*/i, "").trim();
    body = lines
      .slice(lines[1]?.trim() === "" ? 2 : 1)
      .join("\n")
      .trim();
  }

  // Enforce word limit as a final hard ceiling (truncate at sentence boundary if over)
  const words = body.split(/\s+/).filter(Boolean);
  if (words.length > brief.max_words) {
    // Find last sentence boundary within limit
    const truncated = words.slice(0, brief.max_words).join(" ");
    const lastPeriod = Math.max(truncated.lastIndexOf("."), truncated.lastIndexOf("?"), truncated.lastIndexOf("!"));
    body = lastPeriod > 0 ? truncated.slice(0, lastPeriod + 1) : truncated;
  }

  const word_count = body.split(/\s+/).filter(Boolean).length;

  return {
    subject,
    body,
    word_count,
    channel: brief.channel,
    usage: data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } : undefined,
  };
}
