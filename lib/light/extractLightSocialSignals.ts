import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";

export interface SocialSignalResult {
  signals: Signal[];
  detectedPlatforms: string[];
}

// Platform patterns to detect from href attributes in HTML
const SOCIAL_PLATFORMS: { name: string; pattern: RegExp }[] = [
  { name: "facebook",  pattern: /facebook\.com\//i },
  { name: "instagram", pattern: /instagram\.com\//i },
  { name: "linkedin",  pattern: /linkedin\.com\//i },
  { name: "tiktok",    pattern: /tiktok\.com\//i },
  { name: "twitter",   pattern: /twitter\.com\/|x\.com\//i },
  { name: "youtube",   pattern: /youtube\.com\//i },
];

export function extractLightSocialSignals(
  html: string | null,
): SocialSignalResult {
  // No HTML available (website unreachable) — low confidence unknowns
  if (!html || html.trim().length === 0) {
    return {
      detectedPlatforms: [],
      signals: [
        buildSignal({ key: "social_platform_count", value: 0, confidence: 20 }),
        buildSignal({ key: "social_last_post_days", value: null, confidence: 10 }),
      ],
    };
  }

  // Detect which platforms are linked from the site
  const detected = SOCIAL_PLATFORMS
    .filter(({ pattern }) => pattern.test(html))
    .map(({ name }) => name);

  const platformCount = detected.length;

  // social_last_post_days: we can't know this from HTML alone.
  // We signal "unknown" but with a confidence that reflects platform count.
  // More platforms = slightly higher chance of activity = less uncertain.
  const postDaysConfidence = platformCount >= 2 ? 30 : 15;

  return {
    detectedPlatforms: detected,
    signals: [
      buildSignal({
        key: "social_platform_count",
        value: platformCount,
        confidence: platformCount > 0 ? 85 : 70,
      }),
      buildSignal({
        key: "social_last_post_days",
        value: null, // Can't determine from HTML — needs social API (future Premium)
        confidence: postDaysConfidence,
      }),
    ],
  };
}