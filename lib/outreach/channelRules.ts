// lib/outreach/channelRules.ts
// Encoding the Gong/Salesloft/HBR research constraints per channel.
// These are NOT preferences — they are hard limits backed by large-N data.
//
// Sources:
//   Gong 28M emails: ≤100 words, 3-4 sentences → highest reply rates
//   Gong exec study: 50-100 words, 1-4 word subjects, 9s reading window
//   Salesloft 15M emails: ≥20-25% personalization → up to 300% reply lift
//   Salesloft: inbound <50 words → 2× replies vs 100 words

import type { OutreachChannel, CTAStyle, OutreachTone } from "./types";

export interface ChannelConstraints {
  max_words: number;
  min_words: number;
  subject_max_words: number | null;
  requires_subject: boolean;
  pitch_allowed_first_touch: boolean;  // always false per Gong data
  personalization_min_fraction: number; // Salesloft: 0.20-0.25
  cta_must_be_offer: boolean;          // Gong exec: "offer not meeting"
  structure: string[];                  // ordered message components
  notes: string;
}

export const CHANNEL_RULES: Record<OutreachChannel, ChannelConstraints> = {
  email: {
    max_words: 100,
    min_words: 40,
    subject_max_words: 4,              // Gong exec: 1-4 word subjects
    requires_subject: true,
    pitch_allowed_first_touch: false,  // Gong: -57% reply rate when pitching
    personalization_min_fraction: 0.25,// Salesloft: one sentence in four
    cta_must_be_offer: true,           // Gong exec: "offer not meeting request"
    structure: [
      "Hook (1 sentence — observation or disruptive question)",
      "Observation (signal-grounded, verifiable — 1-2 sentences)",
      "Problem/Implication (pattern language, not assertion)",
      "Offer (concrete value asset: benchmark/teardown/insight)",
      "Soft CTA (binary decision, zero pressure)",
    ],
    notes: "Gong 28M email study. Executive variant: 50-75 words max, subject 1-4 words.",
  },

  linkedin_dm: {
    max_words: 75,
    min_words: 25,
    subject_max_words: null,
    requires_subject: false,
    pitch_allowed_first_touch: false,
    personalization_min_fraction: 0.20,
    cta_must_be_offer: true,
    structure: [
      "Hook (one observation — 1 sentence)",
      "Pattern (peer context or problem pattern — 1 sentence)",
      "Permission CTA (binary, low friction — 1 sentence)",
    ],
    notes: "Shorter than email. Conversational. One observation, one CTA. Permission-based framing.",
  },

  cold_call: {
    max_words: 60,    // opener script only — not the full call
    min_words: 15,
    subject_max_words: null,
    requires_subject: false,
    pitch_allowed_first_touch: false,
    personalization_min_fraction: 0.15,
    cta_must_be_offer: true,
    structure: [
      "Opener (permission-based OR peer-context — see data)",
      "Reason (one sentence why you called, tied to signal)",
      "Permission ask or pattern question",
    ],
    // Gong 300M call study opener success rates:
    // Permission-based: 11.18% | Peer-context: 11.24% | "Bad time?": 2.15%
    notes: "Use permission opener (11.18%) or peer-context (11.24%) based on evidence level. Avoid 'bad time?' (2.15%). Cold calls nearly double email reply rate even without connection (Gong 300M calls).",
  },
};

// Derive optimal channel based on lead signals + fit
export function recommendChannel(input: {
  fit_score: number;
  has_website: boolean;
  social_presence: "low" | "medium" | "high" | null;
  opportunity: number;
}): OutreachChannel {
  // High fit + high opportunity → multi-channel justified, prioritize call
  // (Salesloft: multi-channel 4.7× engagement lift)
  // (Gong: cold calls boost email reply rate even without connection)
  if (input.fit_score >= 70 && input.opportunity >= 65) {
    return "cold_call"; // user should sequence: call + email
  }

  // Strong social presence → LinkedIn DM natural entry point
  if (input.social_presence === "high" && input.fit_score >= 50) {
    return "linkedin_dm";
  }

  // Default: email — works across all fit levels
  return "email";
}

// Derive optimal tone based on friction (risk + difficulty signal)
export function recommendTone(input: {
  risk: number;
  opportunity: number;
  fit_score: number;
  acquisition_style?: string;
}): OutreachTone {
  // High risk → conservative, consultative
  if (input.risk >= 70) return "consultative";
  // Premium style + high opportunity → professional/direct
  if (input.acquisition_style === "premium" && input.opportunity >= 70) return "professional";
  // High opportunity, low risk → can push to direct
  if (input.opportunity >= 75 && input.risk <= 35) return "direct";
  // Default → consultative (safest for most cold outreach)
  return "consultative";
}

// Derive CTA style — always offer-based for cold (Gong exec research)
export function recommendCTA(input: {
  channel: OutreachChannel;
  objective: string;
  risk: number;
}): CTAStyle {
  if (input.channel === "cold_call") return "permission";
  if (input.objective === "follow_up") return "soft";
  // First touch cold: offer > meeting request (Gong exec data)
  return "offer";
}