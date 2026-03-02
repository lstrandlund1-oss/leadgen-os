import type { UserProfileV1, SocialPresence, RiskProfile } from "@/lib/types";
import type { Capability } from "@/lib/fit/needs";
import type { OutreachPackage } from "@/lib/types";

export type SellerType = "MARKETING" | "WEB_DEV" | "CONTENT" | "FREELANCER";
export type GapType =
  | "VISIBILITY"
  | "CONVERSION"
  | "INFRASTRUCTURE"
  | "OPTIMIZATION";
export type Difficulty = "LOW" | "MEDIUM" | "HIGH";

export type PitchContext = {
  hasWebsite: boolean;
  socialPresence: SocialPresence;
  opportunity: number; // 0-100
  risk: number; // 0-100
  riskProfile: RiskProfile | null;
  fitScore: number; // 0-100
  missingNeeds: Capability[];
};

export type ScriptInput = {
  // lead facts (deterministic)
  city?: string;
  industry?: string;

  // engine inputs
  sellerType: SellerType;
  gap: GapType;
  difficulty: Difficulty;

  // evidence layer
  ctx: PitchContext;
};

export type GeneratedScript = {
  sellerType: SellerType;
  gap: GapType;
  difficulty: Difficulty;

  angleTitle: string;
  angleWhy: string;

  script: string;
};

export function inferSellerType(profile: UserProfileV1): SellerType {
  // Beta inference: later replace with explicit onboarding field
  if (
    profile.serviceFocus.includes("seo") ||
    profile.serviceFocus.includes("ads")
  )
    return "MARKETING";
  if (
    profile.serviceFocus.includes("branding") &&
    profile.serviceFocus.includes("content")
  )
    return "CONTENT";
  if (profile.serviceFocus.includes("content")) return "CONTENT";
  return "FREELANCER";
}

export function deriveDifficulty(
  opportunity: number,
  risk: number,
): Difficulty {
  // Deterministic thresholds (tweakable)
  if (risk >= 70 || opportunity <= 30) return "HIGH";
  if (risk >= 45 || opportunity <= 55) return "MEDIUM";
  return "LOW";
}

export function deriveGap(ctx: PitchContext): GapType {
  if (!ctx.hasWebsite) return "INFRASTRUCTURE";

  const missing = new Set<Capability>(ctx.missingNeeds);

  // Conversion gaps beat visibility gaps if both exist
  if (missing.has("tracking") || missing.has("funnel") || missing.has("crm"))
    return "CONVERSION";

  if (
    ctx.socialPresence === "low" ||
    missing.has("content") ||
    missing.has("seo")
  )
    return "VISIBILITY";

  return "OPTIMIZATION";
}

function opener(difficulty: Difficulty): string {
  // Make this feel like a real person typed it.
  // No em-dash, no “Quick one—”
  if (difficulty === "HIGH") return "Hey — quick question.";
  if (difficulty === "MEDIUM") return "Hey — hope you're doing well.";
  return "Hey.";
}

function leadScanLine(
  businessName: string,
  industry?: string,
  city?: string,
): string {
  const parts = [
    industry ? `${industry}` : "businesses",
    city ? `in ${city}` : "",
  ].filter(Boolean);
  const scope = parts.length ? parts.join(" ") : "local businesses";
  return `I came across ${businessName} while reviewing ${scope}.`;
}

function gapInsight(gap: GapType, ctx: PitchContext): string {
  if (gap === "INFRASTRUCTURE") {
    return "You’re not currently capturing demand through a structured website/landing flow.";
  }
  if (gap === "VISIBILITY") {
    return ctx.socialPresence === "low"
      ? "Your visibility looks lower than it should be for the quality signals you already have."
      : "There’s likely demand you’re not capturing consistently through high-intent channels.";
  }
  if (gap === "CONVERSION") {
    const missing = new Set<Capability>(ctx.missingNeeds);
    if (missing.has("tracking"))
      return "You likely have leakage because tracking isn’t set up properly—so scaling stays guesswork.";
    if (missing.has("funnel"))
      return "You likely have leakage because there’s no clear funnel turning interest into bookings.";
    if (missing.has("crm"))
      return "You likely have leakage because follow-up isn’t systemized consistently.";
    return "You likely have leakage between interest and actual inquiries/bookings.";
  }
  return "You already have strong fundamentals—this looks like an optimization situation.";
}

function sellerReframe(sellerType: SellerType, gap: GapType): string {
  // Same lead, different seller promise (your moat)
  if (sellerType === "WEB_DEV") {
    return gap === "VISIBILITY"
      ? "In most cases like this, it’s not the service — it’s that the conversion infrastructure isn’t set up to turn interest into leads."
      : "In most cases like this, it’s not traffic — it’s that there’s no conversion system turning intent into booked calls.";
  }
  if (sellerType === "MARKETING") {
    return gap === "INFRASTRUCTURE"
      ? "In most cases like this, growth isn’t a service problem — it’s that demand has nowhere efficient to land and convert."
      : "In most cases like this, it’s not the service — it’s that demand isn’t being captured consistently in the right channels.";
  }
  if (sellerType === "CONTENT") {
    return "In most cases like this, the problem isn’t effort — it’s that attention isn’t structured to convert into inquiries.";
  }
  return "In most cases like this, the issue isn’t effort — it’s having a simple system that turns interest into booked conversations.";
}

function minerQuestion(gap: GapType): string {
  if (gap === "INFRASTRUCTURE")
    return "Out of curiosity, where do you currently send people who want to learn more or book?";
  if (gap === "VISIBILITY")
    return "Out of curiosity, how are you currently generating new clients consistently?";
  if (gap === "CONVERSION")
    return "Out of curiosity, how are you currently turning interest into actual bookings?";
  return "Out of curiosity, are you fully satisfied with how your current setup converts into inquiries?";
}

function microValue(
  sellerType: SellerType,
  gap: GapType,
  ctx: PitchContext,
): string {
  const missing = new Set<Capability>(ctx.missingNeeds);

  if (sellerType === "WEB_DEV") {
    if (gap === "INFRASTRUCTURE")
      return "A single conversion-focused page with clear offer + proof + booking flow.";
    if (gap === "CONVERSION" && missing.has("tracking"))
      return "Basic conversion tracking so you can measure what actually produces leads.";
    if (gap === "CONVERSION" && missing.has("funnel"))
      return "A simple funnel structure: hook → proof → offer → CTA (book/call).";
    return "Tightening the booking path so interest doesn’t leak.";
  }

  if (sellerType === "MARKETING") {
    if (gap === "VISIBILITY")
      return "Shift focus to high-intent capture (search + retarget) instead of broad awareness.";
    if (gap === "INFRASTRUCTURE")
      return "Build a landing flow before scaling spend—otherwise you pay for leakage.";
    return "A measurable acquisition loop: offer → channel → tracking → follow-up.";
  }

  if (sellerType === "CONTENT") {
    if (gap === "VISIBILITY")
      return "A short-form content system that builds trust and pushes a clear next step.";
    if (gap === "CONVERSION")
      return "Restructure content to end with one action (DM, booking link, offer) consistently.";
    return "A trust-to-action structure that makes inquiries predictable.";
  }

  // FREELANCER
  if (gap === "INFRASTRUCTURE")
    return "A clean, simple page that converts interest into a booking.";
  if (gap === "VISIBILITY")
    return "One high-intent channel + proof assets to capture demand quickly.";
  if (gap === "CONVERSION")
    return "One clear conversion path and follow-up to stop leakage.";
  return "A small optimization that increases conversion without changing what you do.";
}

function closeLine(difficulty: Difficulty): string {
  if (difficulty === "HIGH") {
    return "If you want, I can send a short teardown with 2–3 specific improvements. No pressure—just useful.";
  }
  if (difficulty === "MEDIUM") {
    return "If you’re open to it, I can show you 2–3 specific improvements tailored to your setup.";
  }
  return "If you’re open to it, I can show you 2–3 improvements I’d implement right away.";
}

function ctaLine(difficulty: Difficulty): string {
  if (difficulty === "HIGH")
    return "Would it be a bad idea to take a quick look together sometime this week?";
  return "Would it be a bad idea to walk through that?";
}

function angleMeta(
  gap: GapType,
  sellerType: SellerType,
): { title: string; why: string } {
  if (gap === "INFRASTRUCTURE") {
    return {
      title: "Infrastructure gap",
      why: "Interest has nowhere efficient to land and convert.",
    };
  }
  if (gap === "VISIBILITY") {
    return {
      title: "Visibility gap",
      why: "Demand exists, but you’re not capturing it consistently.",
    };
  }
  if (gap === "CONVERSION") {
    return {
      title: "Conversion gap",
      why: "Interest is leaking before it becomes bookings.",
    };
  }
  // OPTIMIZATION
  return {
    title: `${sellerType} optimization`,
    why: "Strong baseline—growth comes from sharpening conversion mechanics.",
  };
}

export function generateScript(input: ScriptInput): OutreachPackage {
  const { title, why } = angleMeta(input.gap, input.sellerType);

  const industryLabel = input.industry ?? "your space";
  const cityLabel = input.city ?? "your area";

  const line1 =
    input.difficulty === "HIGH"
      ? `I was looking through ${industryLabel} in ${cityLabel}, and something stood out.`
      : `I came across your business while looking through ${industryLabel} in ${cityLabel}.`;
  const line2 = `One thing that stood out: ${gapInsight(input.gap, input.ctx)}`;
  const line3 = sellerReframe(input.sellerType, input.gap);
  const line4 = minerQuestion(input.gap);
  const line5 = `One thing I’d adjust immediately is: ${microValue(input.sellerType, input.gap, input.ctx)}.`;
  const line6 = closeLine(input.difficulty);
  const line7 = ctaLine(input.difficulty);

  // --- SOFT VERSION (consultative) ---
  const softLines =
    input.difficulty === "HIGH"
      ? [line1, line2, line3, line4, line6] // shorter, no micro value
      : [line1, line2, line3, line4, line5, line6, line7];

  const soft = softLines.join("\n\n");

  // --- DIRECT VERSION (assertive) ---
  const directLine1 = "Hey, quick question.";

  const directLine4 = line4 ? line4.replace("Out of curiosity,", "") : line4;

  const directLine6 =
    input.difficulty === "HIGH"
      ? "If this is a priority, I can outline exactly what I'd change."
      : "If you're serious about improving this, I can show you exactly what I'd implement.";

  const directLines =
    input.difficulty === "HIGH"
      ? [directLine1, line2, line3, directLine4, directLine6]
      : [directLine1, line2, line3, directLine4, line5, directLine6];

  const direct = directLines.join("\n\n");

  return {
    sellerType: input.sellerType,
    gap: input.gap,
    difficulty: input.difficulty,

    angleTitle: title,
    angleWhy: why,

    variants: { soft, direct },
    defaultVariant: input.difficulty === "HIGH" ? "soft" : "direct",
  };
}
