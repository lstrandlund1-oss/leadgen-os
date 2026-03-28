// lib/sequences/generateSequence.ts
//
// Generates a full 5-step outreach sequence for a lead using the Anthropic API.
//
// Research basis (from evidence-based follow-up strategy doc):
//   - 8-12 touches over 17-21 days. Front-loaded: early touches 1-2 days apart.
//   - 80% of top cadences start with call + email on Day 1.
//   - Multi-channel required: email-only is 77% worse than mixed.
//   - Message length: 50-125 words. Subject: 3-4 words. Max 1-3 questions.
//   - Lead with value first — reply rates drop from 31% at step 2 to 14% at step 8.
//   - Personalization type by profile:
//       owner_operator/small → individual-based (doubles replies)
//       any lead → industry-based social proof (88% lift)
//       gap/signal → activity-based (~3x replies) — Vantio's advantage
//   - High score/clear gap → aggressive front-loaded cadence
//   - Low score/ambiguous → slower nurture, fewer hard asks

import type { StrategyBrief } from "@/lib/outreach/types";

export type SequenceChannel = "email" | "call" | "dm" | "linkedin";

export type SequenceStep = {
  step: number;           // 1-5
  day: number;            // day offset from sequence start (1, 2, 5, 9, 14)
  channel: SequenceChannel;
  subject?: string;       // email only
  message: string;        // the actual copy
  objective: string;      // what this step is trying to achieve (for UI display)
  cta: string;            // the specific ask in this step
};

export type GeneratedSequence = {
  steps: SequenceStep[];
  cadence_type: "aggressive" | "standard" | "nurture";
  total_days: number;
  reasoning: string;      // brief explanation of why this cadence shape was chosen
};

// Day offsets by cadence type — based on research benchmarks
const CADENCE_DAYS: Record<"aggressive" | "standard" | "nurture", number[]> = {
  aggressive: [1, 2, 5, 9, 14],   // hot lead, clear gap, high score
  standard:   [1, 3, 7, 12, 18],  // typical lead
  nurture:    [1, 5, 10, 16, 21], // low score, mature competitor
};

// Channel rotation patterns — never single-channel
const CHANNEL_PATTERNS: Record<"aggressive" | "standard" | "nurture", SequenceChannel[]> = {
  aggressive: ["call", "email", "email", "call", "email"],
  standard:   ["email", "call", "email", "dm", "email"],
  nurture:    ["email", "email", "call", "email", "dm"],
};

function decideCadenceType(
  opportunity: number,
  fitScore: number,
  riskProfile: string,
): "aggressive" | "standard" | "nurture" {
  if (riskProfile === "mature_competitor" || riskProfile === "unstable_business") {
    return "nurture";
  }
  if (opportunity >= 65 && fitScore >= 60) return "aggressive";
  if (opportunity >= 40 || fitScore >= 50) return "standard";
  return "nurture";
}

function buildSystemPrompt(): string {
  return `You are a world-class B2B sales strategist generating outreach sequences for small business leads.

CORE RULES (non-negotiable):
- Each message must be 50-125 words. No exceptions. Count carefully.
- Subject lines: 3-4 words maximum.
- Each message asks maximum 1-2 questions. Never more.
- Lead with value and insight — NEVER lead with "I noticed" or "I wanted to reach out" or "just following up"
- Never mention your own effort or activity ("I called earlier", "I sent an email last week")
- Each step must feel like a genuinely new angle — not a repeat of previous steps
- Tone: conversational, peer-to-peer — not salesy, not corporate
- The message should feel like it was written by a sharp human, not an AI

RESEARCH-BACKED PATTERNS:
- Step 1 establishes the value angle (strongest message — reply rates drop each step)
- Step 2 adds social proof or industry insight (different angle, not a reminder)
- Step 3 acknowledges they're busy, reframes the offer as low-risk
- Step 4 creates mild urgency or asks a direct question
- Step 5 is a graceful last touch — leaves the door open without pressure

PERSONALIZATION RULES:
- For owner-operator leads: reference their specific business context (doubles replies)
- Always use industry-based social proof where possible (88% reply rate lift)
- Connect to the specific gap detected — this is activity-based personalization (~3x lift)

OUTPUT FORMAT:
Return a valid JSON object with this exact structure — no markdown, no explanation, just the JSON:
{
  "steps": [
    {
      "step": 1,
      "subject": "3-4 word subject",
      "message": "50-125 word message body",
      "objective": "one sentence — what this step achieves",
      "cta": "the specific ask"
    }
  ],
  "reasoning": "1-2 sentences on why this cadence shape was chosen for this lead"
}`;
}

function buildUserPrompt(
  brief: StrategyBrief,
  cadenceType: "aggressive" | "standard" | "nurture",
  channels: SequenceChannel[],
  days: number[],
  opportunity: number,
  fitScore: number,
  riskProfile: string,
): string {
  const gapDescriptions = {
    INFRASTRUCTURE: "no website — missing digital foundation, all demand is leaking",
    CONVERSION: "has web presence but no system to convert visitors into bookings/enquiries",
    VISIBILITY: "good service quality but not reaching enough of the right people",
    OPTIMIZATION: "solid foundation — needs sharpening on highest-leverage conversion points",
  };

  const cadenceRationale = {
    aggressive: "This is a high-opportunity lead with a clear gap — use a front-loaded, multi-touch approach",
    standard: "Standard cadence — build value across channels with measured spacing",
    nurture: "Slower cadence — this lead needs more consideration time, focus on insights not asks",
  };

  return `Generate a ${cadenceType} outreach sequence for this lead.

LEAD PROFILE:
- Company: ${brief.company_name}
- Industry: ${brief.industry ?? "local business"}
- City: ${brief.city ?? "unknown"}
- Gap type: ${brief.gap_type} — ${gapDescriptions[brief.gap_type]}
- Opportunity score: ${opportunity}/100
- Fit score: ${fitScore}/100
- Risk profile: ${riskProfile}

LEAD STRENGTHS: ${brief.lead_strengths.join(", ") || "none detected"}
LEAD WEAKNESSES: ${brief.lead_weaknesses.join(", ") || "none detected"}
TOP OPPORTUNITY: ${brief.top_opportunity}
RECOMMENDED ANGLE: ${brief.recommended_angle}

SELLER PROFILE:
- Service: ${brief.user_offer}
- Type: ${brief.user_business_type}

SEQUENCE STRUCTURE (generate exactly 5 steps):
${channels.map((ch, i) => `Step ${i + 1} | Day ${days[i]} | Channel: ${ch}`).join("\n")}

CADENCE DIRECTION: ${cadenceRationale[cadenceType]}

Language: ${brief.language === "sv" ? "Swedish" : "English"}

${brief.language === "sv" ? "Write all messages in natural Swedish. Subject lines in Swedish." : "Write all messages in natural English."}

Remember: Step 1 is your STRONGEST message. Each subsequent step takes a different angle. No repetition. 50-125 words per message body.`;
}

export async function generateSequence(
  brief: StrategyBrief,
  opportunity: number,
  fitScore: number,
  riskProfile: string,
  apiKey: string,
): Promise<GeneratedSequence> {
  const cadenceType = decideCadenceType(opportunity, fitScore, riskProfile);
  const days = CADENCE_DAYS[cadenceType];
  const channels = CHANNEL_PATTERNS[cadenceType];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserPrompt(brief, cadenceType, channels, days, opportunity, fitScore, riskProfile),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };

  const text = data.content.find(b => b.type === "text")?.text ?? "";

  // Strip markdown fences if present
  const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: { steps: Array<{ step: number; subject?: string; message: string; objective: string; cta: string }>; reasoning: string };
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Failed to parse sequence JSON from AI response");
  }

  // Merge AI content with structural decisions (days, channels)
  const steps: SequenceStep[] = parsed.steps.map((s, i) => ({
    step: s.step ?? (i + 1),
    day: days[i],
    channel: channels[i],
    subject: s.subject,
    message: s.message,
    objective: s.objective,
    cta: s.cta,
  }));

  return {
    steps,
    cadence_type: cadenceType,
    total_days: days[days.length - 1],
    reasoning: parsed.reasoning ?? "",
  };
}