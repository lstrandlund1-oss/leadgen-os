// lib/outreach/generateMessage.ts
// Stage B — AI Message Generator
//
// Purpose: convert the StrategyBrief into a raw message draft via Claude.
// The brief is the ONLY source of truth — no hallucination, no invention.
// All claims in the output must be traceable to brief fields.
//
// Key constraints from research:
//   • NO pitching on first-touch cold (Gong: -57% reply rate)
//   • ≤100 words email, ≤75 words LinkedIn DM (Gong large-N data)
//   • ≥20-25% of message = personalized to real signals (Salesloft: up to 300% reply lift)
//   • CTA = offer, not meeting request (Gong exec research)
//   • Subject = 1-4 words max (Gong exec: open rates decline beyond this)
//   • Optimize for POSITIVE reply rate, not raw reply (Outreach: 33% higher meeting correlation)

import type { StrategyBrief, GeneratedDraft } from "./types";
import { CHANNEL_RULES } from "./channelRules";

function buildSystemPrompt(brief: StrategyBrief): string {
  const lang = brief.language === "sv" ? "Swedish" : "English";
  const rules = CHANNEL_RULES[brief.channel];

  return `You are a signal-driven outreach writer for Vantio, a B2B lead intelligence platform.

Your task: write ONE ${brief.channel === "email" ? "cold email" : brief.channel === "linkedin_dm" ? "LinkedIn DM" : "cold call opener script"} in ${lang}.

HARD CONSTRAINTS — violating any of these makes the output worthless:
1. Maximum ${brief.max_words} words in the body. Count carefully. Do not exceed this.
2. ${brief.requires_subject ? `Subject line: maximum ${brief.subject_max_words} words. One priority phrase only.` : "No subject line."}
3. DO NOT pitch the service or product. This is a first-touch cold message. Pitching reduces reply rates by 57% (Gong, 28M emails).
4. DO NOT use any of these words: AI, platform, all-in-one, solution, ROI, leverage, synergy, innovation, streamline, cutting-edge, game-changer.
5. At least ${Math.round(brief.personalization_target * 100)}% of the message must reference the lead's actual situation — not a generic pattern.
6. CTA must be an OFFER of value (benchmark, teardown, insight), NOT a meeting request. Gong exec research: "make an offer, not a meeting request."
7. Write exactly ONE message. No variants, no alternatives, no options.
8. Respond ONLY with the message — no preamble, no explanation, no labels.

STRUCTURE TO FOLLOW (in order, no deviation):
${rules.structure.map((s, i) => `${i + 1}. ${s}`).join("\n")}

PERSUASION PRINCIPLES (apply naturally, not mechanically):
- Reciprocity: offer something genuinely useful before asking for anything
- Social proof: use peer patterns ("businesses like this often...") not invented claims
- Curiosity: open a loop the prospect wants closed
- Reduction of buyer effort: make responding feel like zero work
- Problem framing: make the cost of the status quo visible, briefly

GDPR / ETHICS GUARDRAIL:
- Personalization must feel like you noticed something about their business, NOT like surveillance
- Use only signals the prospect can connect to their own visible business context
- No manufactured urgency, no invented scarcity`;
}

function buildUserPrompt(brief: StrategyBrief): string {
  const lang = brief.language === "sv" ? "Swedish" : "English";

  const strengthsText = brief.lead_strengths.length > 0 ? brief.lead_strengths.join(", ") : "limited data available";
  const weaknessesText =
    brief.lead_weaknesses.length > 0 ? brief.lead_weaknesses.join(", ") : "no obvious gaps identified";

  // Channel-specific opener guidance (Gong 300M call study)
  const callOpenerNote =
    brief.channel === "cold_call"
      ? `\nCOLD CALL OPENER DATA (Gong, 300M calls):
- Permission opener ("This is a cold call — do you want to hang up, or can I take 20 seconds?"): 11.18% success
- Peer-context opener ("Have you heard our name tossed around?"): 11.24% success  
- "How's your day going?": 7.6% success
- "Did I catch you at a bad time?": 2.15% success (avoid)
Choose the opener appropriate to evidence level: ${brief.evidence_confidence} evidence → ${brief.evidence_confidence === "high" ? "peer-context opener" : "permission-based opener"}.`
      : "";

  const executiveNote =
    brief.channel === "email" && brief.evidence_confidence === "low"
      ? "\nNOTE: This is a high-friction lead. Executives spend max 9 seconds reading (Gong research). Aim for 50-75 words, not 100. Be tighter."
      : "";

  return `Write a ${brief.channel === "email" ? "cold email" : brief.channel === "linkedin_dm" ? "LinkedIn DM" : "cold call opener"} in ${lang}.

LEAD: ${brief.company_name}
Industry: ${brief.industry ?? "unknown"}
City: ${brief.city ?? "unknown"}
Peer group context: ${brief.peer_group}

WHAT THEY HAVE (use as social proof / anchor):
${strengthsText}

WHAT THEY'RE MISSING (the opportunity — do not state these as facts, use pattern language):
${weaknessesText}

CORE OPPORTUNITY:
${brief.top_opportunity}

YOUR ANGLE:
${brief.recommended_angle}

GAP TYPE: ${brief.gap_type}
TONE: ${brief.tone}
CTA STYLE: ${brief.cta_style}
EVIDENCE CONFIDENCE: ${brief.evidence_confidence}

THE SENDER:
Business type: ${brief.user_business_type}
What they offer: ${brief.user_offer}
${callOpenerNote}${executiveNote}

EVIDENCE CONFIDENCE NOTE:
${
  brief.evidence_confidence === "high"
    ? "You have strong signal data. Lead with specific, verifiable observations ('saw this on your website...'). Make concrete offers."
    : brief.evidence_confidence === "medium"
      ? "You have moderate signal data. Use pattern language ('businesses in this situation often...'). Avoid overclaiming."
      : "You have limited signal data. Use hypothesis framing ('often when [peer group] is trying to [goal]...'). Ask, don't assert."
}

${
  brief.requires_subject
    ? `Write the subject on the FIRST line, starting with "Subject: "
Then a blank line, then the body.`
    : "Write only the message body."
}`;
}

export async function generateMessage(brief: StrategyBrief, apiKey: string): Promise<GeneratedDraft> {
  const systemPrompt = buildSystemPrompt(brief);
  const userPrompt = buildUserPrompt(brief);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stage B generation failed: ${res.status} ${err}`);
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

  // Parse subject from email output
  let subject: string | undefined;
  let body = rawText;

  if (brief.requires_subject && rawText.startsWith("Subject:")) {
    const lines = rawText.split("\n");
    const subjectLine = lines[0].replace(/^Subject:\s*/i, "").trim();
    subject = subjectLine;
    // Skip blank line after subject
    body = lines
      .slice(lines[1]?.trim() === "" ? 2 : 1)
      .join("\n")
      .trim();
  }

  const word_count = body.split(/\s+/).filter(Boolean).length;

  return {
    subject,
    body,
    word_count,
    structure_used: CHANNEL_RULES[brief.channel].structure.join(" → "),
    usage: data.usage ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens } : undefined,
  };
}
