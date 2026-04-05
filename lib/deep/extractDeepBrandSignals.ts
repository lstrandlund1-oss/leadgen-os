// lib/deep/extractDeepBrandSignals.ts
//
// Deterministic brand and content quality scoring.
// Evaluates how well a business presents itself across its content channels —
// website copy, social posts, imagery, and brand consistency.
// No ML — rule-based scoring with explicit thresholds and reasoning.

import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";

export interface DeepBrandInput {
  // Content quality signals (from page analysis)
  wordCountHomepage: number | null; // thin < 200, good 300-800, verbose > 1200
  hasAboutPage: boolean;
  hasTeamPage: boolean;
  hasCaseStudies: boolean;
  hasPortfolio: boolean;
  hasBlogOrNews: boolean;
  blogPostCount: number; // 0 = no content engine
  lastBlogPostDaysAgo: number | null; // null = unknown

  // Social content quality
  primaryPlatform: "instagram" | "facebook" | "tiktok" | "linkedin" | "none";
  postFrequencyPerWeek: number | null; // null = unknown / not detectable
  hasVideoContent: boolean;
  hasUserGeneratedContent: boolean; // reposts, customer tags
  averageEngagementRate: number | null; // 0-1 ratio, null = unknown

  // Brand consistency signals
  hasLogoInHeader: boolean;
  colorSchemeConsistent: boolean; // detected from CSS or visual analysis
  fontsConsistent: boolean;
  hasCustomDomain: boolean; // not a free subdomain
  usesGenericEmailProvider: boolean; // gmail/yahoo vs custom domain
}

export interface DeepBrandResult {
  signals: Signal[];
  scores: {
    contentQuality: number; // 0-100
    socialEngagement: number; // 0-100
    brandConsistency: number; // 0-100
    postingFrequency: number; // 0-100
  };
  brandGrade: "A" | "B" | "C" | "D" | "F";
  weakestArea: string;
  strengthArea: string;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function extractDeepBrandSignals(input: DeepBrandInput): DeepBrandResult {
  // Content quality
  let content = 0;
  const wc = input.wordCountHomepage ?? 0;
  if (wc >= 300 && wc <= 900) content += 25;
  else if (wc > 100) content += 12;
  if (input.hasAboutPage) content += 15;
  if (input.hasTeamPage) content += 10;
  if (input.hasCaseStudies || input.hasPortfolio) content += 20;
  if (input.hasBlogOrNews) {
    content += 15;
    if (input.blogPostCount >= 10) content += 10;
    if (input.lastBlogPostDaysAgo !== null && input.lastBlogPostDaysAgo <= 30) content += 5;
  }
  const contentQuality = clamp(content);

  // Social engagement
  let social = 0;
  if (input.averageEngagementRate !== null) {
    if (input.averageEngagementRate >= 0.05) social += 40;
    else if (input.averageEngagementRate >= 0.02) social += 25;
    else if (input.averageEngagementRate >= 0.005) social += 10;
  }
  if (input.hasVideoContent) social += 20;
  if (input.hasUserGeneratedContent) social += 20;
  if (input.primaryPlatform !== "none") social += 10;
  if (input.primaryPlatform === "instagram" || input.primaryPlatform === "tiktok") social += 10; // visual = higher eng
  const socialEngagement = clamp(social);

  // Brand consistency — only meaningful if there's active presence to be consistent about.
  // A logo and custom domain mean nothing if there's zero social activity or content.
  let brand = 0;
  if (input.hasLogoInHeader) brand += 20;
  if (input.colorSchemeConsistent) brand += 20;
  if (input.fontsConsistent) brand += 15;
  if (input.hasCustomDomain) brand += 25;
  if (!input.usesGenericEmailProvider) brand += 20;

  // Presence penalty — if there's no active content or social presence,
  // brand consistency is largely irrelevant. Cap it accordingly.
  const hasActivePresence =
    (input.postFrequencyPerWeek ?? 0) > 0 ||
    input.hasBlogOrNews ||
    input.hasVideoContent ||
    input.primaryPlatform !== "none";

  if (!hasActivePresence) {
    // Business has static branding but no active presence — cap at 30
    brand = Math.min(brand, 30);
  }
  const brandConsistency = clamp(brand);

  // Posting frequency
  let freq = 0;
  const ppw = input.postFrequencyPerWeek ?? 0;
  if (ppw >= 5) freq = 95;
  else if (ppw >= 3) freq = 75;
  else if (ppw >= 1) freq = 50;
  else if (ppw > 0) freq = 25;
  else freq = 0;
  const postingFrequency = clamp(freq);

  // Brand grade (composite)
  const composite = contentQuality * 0.35 + socialEngagement * 0.25 + brandConsistency * 0.25 + postingFrequency * 0.15;
  const brandGrade: "A" | "B" | "C" | "D" | "F" =
    composite >= 75 ? "A" : composite >= 60 ? "B" : composite >= 45 ? "C" : composite >= 30 ? "D" : "F";

  // Weakest and strongest areas
  const areas: [string, number][] = [
    ["content depth", contentQuality],
    ["social engagement", socialEngagement],
    ["brand consistency", brandConsistency],
    ["posting frequency", postingFrequency],
  ];
  areas.sort((a, b) => a[1] - b[1]);
  const weakestArea = areas[0][0];
  const strengthArea = areas[areas.length - 1][0];

  const signals: Signal[] = [
    buildSignal({
      key: "brand_content_quality",
      value: contentQuality,
      confidence: input.wordCountHomepage !== null ? 80 : 55,
      depth: "deep",
      present: contentQuality >= 50,
      description:
        contentQuality >= 70
          ? "Rich content presence: about page, case studies, blog active."
          : contentQuality >= 45
            ? "Moderate content. Key pages present but depth is thin."
            : "Thin content. Homepage is sparse, no case studies or active blog.",
    }),
    buildSignal({
      key: "posting_frequency_score",
      value: postingFrequency,
      confidence: input.postFrequencyPerWeek !== null ? 80 : 45,
      depth: "deep",
      present: postingFrequency >= 40,
      description:
        postingFrequency >= 70
          ? `Active posting cadence (~${input.postFrequencyPerWeek ?? "?"}/week). Content engine is running.`
          : postingFrequency >= 35
            ? "Inconsistent posting. Presence exists but not maintained."
            : "Dormant or absent social content. Major visibility gap.",
    }),
  ];

  return {
    signals,
    scores: { contentQuality, socialEngagement, brandConsistency, postingFrequency },
    brandGrade,
    weakestArea,
    strengthArea,
  };
}
