// lib/outreach/strategyBrief.ts
// Stage A — Deterministic Strategy Engine
//
// Purpose: convert raw lead + user data into a structured StrategyBrief.
// This is the single source of truth passed to Stage B (AI generation).
// No AI calls here. Pure signal → intent mapping.
//
// Research basis:
//   CEB/HBR: buyers complete 60% of purchase before talking to seller.
//   Buyers need insight delivered BEFORE they ask — this brief encodes that.
//   Gartner: "modular agent-ready building blocks" for AI-powered enablement.

import type {
  StrategyBrief,
  OutreachChannel,
  OutreachTone,
  CTAStyle,
  OutreachObjective,
  EvidenceConfidence,
  OutreachRequest,
} from "./types";
import {
  CHANNEL_RULES,
  recommendChannel,
  recommendTone,
  recommendCTA,
} from "./channelRules";

// ── Signal → human insight conversion ──────────────────────────────────────
// This is the "Opportunity Interpretation Layer" from the spec.
// Signals must NOT be passed raw — they must be processed into meaning.

function extractStrengths(signals: OutreachRequest["signals"]): string[] {
  const strengths: string[] = [];

  const rating = signals["rating"]?.value;
  if (typeof rating === "number" && rating >= 4.2) {
    strengths.push(`strong customer reputation (${rating}★)`);
  }
  const reviews = signals["review_count"]?.value;
  if (typeof reviews === "number" && reviews >= 30) {
    strengths.push(`established review base (${reviews} reviews)`);
  }
  const hasWebsite = signals["website_exists"]?.value;
  if (hasWebsite === true) {
    strengths.push("active web presence");
  }
  const social = signals["social_presence"]?.value;
  if (social === "high" || social === "medium") {
    strengths.push(`${social} social media presence`);
  }
  const ownerResponse = signals["owner_response_presence"]?.value;
  if (ownerResponse === true) {
    strengths.push("owner actively responds to reviews");
  }
  const hasOffer = signals["website_has_clear_offer"]?.value;
  if (hasOffer === true) {
    strengths.push("clear service offer on website");
  }
  const hasCTA = signals["website_has_booking_cta"]?.value;
  if (hasCTA === true) {
    strengths.push("booking CTA present");
  }
  const brandQuality = signals["brand_content_quality"]?.value;
  if (typeof brandQuality === "number" && brandQuality >= 70) {
    strengths.push("strong brand content quality");
  }

  return strengths;
}

function extractWeaknesses(signals: OutreachRequest["signals"], missing_needs: string[]): string[] {
  const weaknesses: string[] = [];

  const hasWebsite = signals["website_exists"]?.value;
  if (hasWebsite === false) {
    weaknesses.push("no website — missing digital foundation");
  }
  const social = signals["social_presence"]?.value;
  if (social === "low") {
    weaknesses.push("low social media visibility");
  }
  const hasCTA = signals["website_has_booking_cta"]?.value;
  if (hasCTA === false) {
    weaknesses.push("no booking or contact CTA on website");
  }
  const hasOffer = signals["website_has_clear_offer"]?.value;
  if (hasOffer === false) {
    weaknesses.push("offer unclear on website");
  }
  const mobileFriendly = signals["website_mobile_friendly"]?.value;
  if (mobileFriendly === false) {
    weaknesses.push("website not mobile-friendly");
  }
  const lastPost = signals["social_last_post_days"]?.value;
  if (typeof lastPost === "number" && lastPost > 30) {
    weaknesses.push(`social media inactive (last post ${lastPost} days ago)`);
  }
  const pageSpeed = signals["website_page_speed_score"]?.value;
  if (typeof pageSpeed === "number" && pageSpeed < 50) {
    weaknesses.push(`slow website performance (score: ${pageSpeed}/100)`);
  }
  const seo = signals["website_seo_structure_score"]?.value;
  if (typeof seo === "number" && seo < 50) {
    weaknesses.push("weak SEO structure");
  }

  // From fit engine
  if (missing_needs.includes("tracking")) {
    weaknesses.push("no conversion tracking — scaling stays guesswork");
  }
  if (missing_needs.includes("funnel")) {
    weaknesses.push("no structured booking funnel");
  }
  if (missing_needs.includes("crm")) {
    weaknesses.push("no follow-up system");
  }

  return weaknesses;
}

function deriveGapType(
  signals: OutreachRequest["signals"],
  missing_needs: string[],
): StrategyBrief["gap_type"] {
  const hasWebsite = signals["website_exists"]?.value;
  if (!hasWebsite) return "INFRASTRUCTURE";

  const missing = new Set(missing_needs);
  if (missing.has("tracking") || missing.has("funnel") || missing.has("crm")) {
    return "CONVERSION";
  }

  const social = signals["social_presence"]?.value;
  if (social === "low" || missing.has("content") || missing.has("seo")) {
    return "VISIBILITY";
  }

  return "OPTIMIZATION";
}

function deriveTopOpportunity(
  strengths: string[],
  weaknesses: string[],
  gap_type: StrategyBrief["gap_type"],
): string {
  if (gap_type === "INFRASTRUCTURE") {
    return "Business has demand but no digital system to capture it";
  }
  if (gap_type === "CONVERSION") {
    const hasRep = strengths.some(s => s.includes("reputation") || s.includes("review"));
    return hasRep
      ? "Strong reputation but interest is leaking before becoming bookings"
      : "Visitors arriving but no structured path to convert them";
  }
  if (gap_type === "VISIBILITY") {
    const hasRep = strengths.some(s => s.includes("reputation") || s.includes("review"));
    return hasRep
      ? "Strong trust signals but demand isn't being captured consistently"
      : "Service quality exists but not reaching enough of the right audience";
  }
  return "Solid foundation — growth comes from sharpening conversion mechanics";
}

function deriveRecommendedAngle(
  gap_type: StrategyBrief["gap_type"],
  user_business_type: string,
): string {
  const type = user_business_type.toLowerCase();

  if (gap_type === "INFRASTRUCTURE") {
    if (type.includes("web") || type.includes("developer")) {
      return "Build the digital foundation — one conversion-focused page captures the demand that's currently going nowhere";
    }
    return "Establish the digital system before scaling any acquisition effort";
  }
  if (gap_type === "CONVERSION") {
    if (type.includes("marketing") || type.includes("ads")) {
      return "Fix the funnel before scaling spend — otherwise every ad drives leakage, not revenue";
    }
    return "Close the gap between interest and bookings with a clear conversion path";
  }
  if (gap_type === "VISIBILITY") {
    if (type.includes("content") || type.includes("seo")) {
      return "Leverage existing trust to build consistent inbound through structured content and search";
    }
    return "Redirect existing reputation into high-intent capture channels";
  }
  return "Optimize the highest-leverage conversion point to compound existing results";
}

function deriveUserOffer(profile?: OutreachRequest["user_profile"]): string {
  if (!profile?.profileType) return "digital growth services";

  const map: Record<string, string> = {
    performance_marketer: "paid acquisition and conversion optimization",
    web_developer: "website and landing page development",
    content_creator: "content strategy and social media growth",
    seo_specialist: "SEO and local search visibility",
    full_service_agency: "full-stack digital marketing and execution",
  };
  return map[profile.profileType] ?? "digital marketing services";
}

function deriveUserBusinessType(profile?: OutreachRequest["user_profile"]): string {
  if (!profile?.profileType) return "digital service provider";

  const map: Record<string, string> = {
    performance_marketer: "performance marketer",
    web_developer: "web developer",
    content_creator: "content creator",
    seo_specialist: "SEO specialist",
    full_service_agency: "full-service agency",
  };
  return map[profile.profileType] ?? "digital service provider";
}

function derivePeerGroup(industry: string | null, city: string | null): string {
  const loc = city ? `i ${city}` : "";
  const ind = industry ?? "lokala företag";
  return `${ind}${loc ? " " + loc : ""}`.trim();
}

function deriveEvidenceConfidence(
  signals: OutreachRequest["signals"],
): EvidenceConfidence {
  const keys = Object.keys(signals);
  const deepSignals = keys.filter(k =>
    ["website_page_speed_score", "website_seo_structure_score", "website_cta_strength",
     "booking_flow_quality", "brand_content_quality", "posting_frequency_score",
     "competitor_density"].includes(k)
  );
  const lightSignals = keys.filter(k =>
    ["website_has_contact_page", "website_has_booking_cta", "website_has_clear_offer",
     "website_mobile_friendly", "social_platform_count", "social_last_post_days",
     "owner_response_presence"].includes(k)
  );

  if (deepSignals.length >= 3) return "high";
  if (lightSignals.length >= 3 || deepSignals.length >= 1) return "medium";
  return "low";
}

function deriveEvidenceDepth(
  signals: OutreachRequest["signals"],
): "base" | "light" | "deep" {
  const deepSignals = Object.keys(signals).filter(k =>
    ["website_page_speed_score", "website_seo_structure_score", "website_cta_strength",
     "booking_flow_quality", "brand_content_quality", "competitor_density"].includes(k)
  );
  const lightSignals = Object.keys(signals).filter(k =>
    ["website_has_contact_page", "website_has_booking_cta", "website_has_clear_offer",
     "website_mobile_friendly", "social_platform_count"].includes(k)
  );

  if (deepSignals.length >= 2) return "deep";
  if (lightSignals.length >= 2) return "light";
  return "base";
}

// ── Main export ─────────────────────────────────────────────────────────────
export function buildStrategyBrief(req: OutreachRequest): StrategyBrief {
  const strengths = extractStrengths(req.signals);
  const weaknesses = extractWeaknesses(req.signals, req.missing_needs);
  const gap_type = deriveGapType(req.signals, req.missing_needs);
  const top_opportunity = deriveTopOpportunity(strengths, weaknesses, gap_type);
  const user_business_type = deriveUserBusinessType(req.user_profile);
  const recommended_angle = deriveRecommendedAngle(gap_type, user_business_type);
  const user_offer = deriveUserOffer(req.user_profile);
  const evidence_confidence = deriveEvidenceConfidence(req.signals);
  const evidence_depth = deriveEvidenceDepth(req.signals);
  const peer_group = derivePeerGroup(req.industry, req.city);

  const has_website = req.signals["website_exists"]?.value === true || !!req.website;

  // Channel: user override > system recommendation
  const channel: OutreachChannel = req.channel ?? recommendChannel({
    fit_score: req.fit_score,
    has_website,
    social_presence: req.social_presence,
    opportunity: req.opportunity,
  });

  // Tone: user override > system recommendation
  const tone: OutreachTone = req.tone ?? recommendTone({
    risk: req.risk,
    opportunity: req.opportunity,
    fit_score: req.fit_score,
    acquisition_style: req.user_profile?.acquisitionStyle,
  });

  // CTA: user override > system recommendation
  const cta_style: CTAStyle = req.cta_style ?? recommendCTA({
    channel,
    objective: req.objective ?? "first_touch",
    risk: req.risk,
  });

  const objective: OutreachObjective = req.objective ?? "first_touch";
  const language = req.language ?? "sv";

  const rules = CHANNEL_RULES[channel];

  return {
    channel,
    tone,
    cta_style,
    objective,
    language,

    lead_strengths: strengths,
    lead_weaknesses: weaknesses,
    top_opportunity,
    recommended_angle,
    gap_type,

    user_offer,
    user_business_type,

    evidence_confidence,
    evidence_depth,

    max_words: rules.max_words,
    subject_max_words: rules.subject_max_words,
    requires_subject: rules.requires_subject,
    pitch_allowed: false, // NEVER pitch on first touch cold (Gong: -57% reply rate)
    personalization_target: rules.personalization_min_fraction,

    company_name: req.company_name,
    industry: req.industry,
    city: req.city,
    peer_group,
  };
}