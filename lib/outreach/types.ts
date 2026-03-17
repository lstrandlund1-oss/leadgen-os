// lib/outreach/types.ts
// Shared types for the three-stage outreach pipeline

export type OutreachChannel = "email" | "linkedin_dm" | "cold_call";

export type OutreachTone =
  | "professional"
  | "consultative"
  | "friendly"
  | "direct"
  | "bold";

export type CTAStyle =
  | "soft"       // "open to taking a look?"
  | "offer"      // "I can send a benchmark — worth it?"
  | "question"   // curiosity / permission
  | "permission"; // "do you want to hang up or can I take 20 seconds"

export type OutreachObjective =
  | "first_touch"
  | "follow_up"
  | "re_engage";

export type EvidenceConfidence = "low" | "medium" | "high";

// ── Stage A output ─────────────────────────────────────────────────────────
export interface StrategyBrief {
  channel: OutreachChannel;
  tone: OutreachTone;
  cta_style: CTAStyle;
  objective: OutreachObjective;
  language: "sv" | "en";

  // Lead intelligence
  lead_strengths: string[];      // e.g. ["strong review rating", "high engagement"]
  lead_weaknesses: string[];     // e.g. ["no social media", "missing booking CTA"]
  top_opportunity: string;       // e.g. "strong trust but low visibility"
  recommended_angle: string;     // e.g. "leverage reputation to drive inbound"
  gap_type: "VISIBILITY" | "CONVERSION" | "INFRASTRUCTURE" | "OPTIMIZATION";

  // User context
  user_offer: string;            // what the user sells, derived from profile
  user_business_type: string;    // e.g. "performance marketer", "web developer"

  // Evidence quality
  evidence_confidence: EvidenceConfidence;
  evidence_depth: "base" | "light" | "deep";

  // Channel-specific constraints (from channelRules)
  max_words: number;
  subject_max_words: number | null; // null for non-email
  requires_subject: boolean;
  pitch_allowed: boolean;        // always false for first-touch cold
  personalization_target: number; // fraction e.g. 0.25

  // Lead identity (for message slot-filling)
  company_name: string;
  industry: string | null;
  city: string | null;
  peer_group: string;            // e.g. "restauranger i Stockholm"
}

// ── Stage B output ─────────────────────────────────────────────────────────
export interface GeneratedDraft {
  subject?: string;       // only for email channel
  body: string;
  word_count: number;
  structure_used: string; // e.g. "Hook → Observation → Problem → Offer → CTA"
}

// ── Stage C output ─────────────────────────────────────────────────────────
export interface HumanizedMessage {
  subject?: string;
  body: string;
  word_count: number;
  channel: OutreachChannel;
}

// ── Final package returned to the UI ───────────────────────────────────────
export interface OutreachResult {
  brief: StrategyBrief;
  message: HumanizedMessage;
  generated_at: string;
}

// ── Input from the dashboard UI ────────────────────────────────────────────
export interface OutreachRequest {
  // Lead data
  company_name: string;
  industry: string | null;
  city: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  social_presence: "low" | "medium" | "high" | null;

  // Scores
  opportunity: number;
  readiness: number;
  risk: number;

  // Signal data (whatever depth is available)
  signals: Record<string, {
    key: string;
    value: string | number | boolean | null;
    present: boolean;
    label: string;
    category: string;
  }>;

  // Fit data
  matched_needs: string[];
  missing_needs: string[];
  fit_score: number;

  // User selections (all optional — system decides if not provided)
  channel?: OutreachChannel;
  tone?: OutreachTone;
  cta_style?: CTAStyle;
  objective?: OutreachObjective;
  language?: "sv" | "en";

  // User profile (auto-injected server-side)
  user_profile?: {
    profileType?: string;
    businessName?: string;
    capabilities?: Record<string, boolean>;
    acquisitionStyle?: string;
  };
}