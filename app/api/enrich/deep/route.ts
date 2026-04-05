// app/api/enrich/deep/route.ts
//
// Deep enrichment endpoint. Accepts a website URL + optional market/brand hints,
// fetches the page, parses signals, and runs all three deep extractors.
// Returns structured scores + signals for each layer.
//
// POST /api/enrich/deep
// Body: { website, nearbyCompetitorCount?, nearbyWithWebsite?, nearbyHighRated?,
//         nearbyHighReviewCount?, searchVolumeProxy?, primaryPlatform?,
//         postFrequencyPerWeek? }

import { NextResponse } from "next/server";
import { extractDeepWebsiteSignals } from "@/lib/deep/extractDeepWebsiteSignals";
import { extractDeepMarketSignals } from "@/lib/deep/extractDeepMarketSignals";
import { extractDeepBrandSignals } from "@/lib/deep/extractDeepBrandSignals";
import type { DeepWebsiteInput } from "@/lib/deep/extractDeepWebsiteSignals";
import type { DeepMarketInput } from "@/lib/deep/extractDeepMarketSignals";
import type { DeepBrandInput } from "@/lib/deep/extractDeepBrandSignals";

// ── HTML parsing helpers ──────────────────────────────────────────────────────

function parseWebsiteSignals(html: string, url: string, loadTimeMs: number, pageSizeBytes: number): DeepWebsiteInput {
  const lower = html.toLowerCase();

  const h1Matches = html.match(/<h1[\s>]/gi) ?? [];
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']{1,300})["']/i);
  const internalLinks = (html.match(/href=["'][^"'#][^"']*["']/gi) ?? []).filter((h) => !h.includes("http"));
  const images = html.match(/<img[\s>]/gi) ?? [];
  const imagesWithAlt = html.match(/<img[^>]+alt=["'][^"']+["']/gi) ?? [];
  const ctaButtons =
    html.match(/<(button|a)[^>]*>(book|call|get|start|contact|schedule|free|quote)[^<]{0,40}<\/(button|a)>/gi) ?? [];

  const primaryCtaMatch = ctaButtons[0]?.match(/>([^<]+)</i);
  const primaryCtaText = primaryCtaMatch?.[1]?.trim() ?? null;

  return {
    hasH1: h1Matches.length > 0,
    h1Count: h1Matches.length,
    hasMetaDescription: !!metaDesc,
    metaDescriptionLength: metaDesc ? metaDesc[1].length : null,
    internalLinkCount: internalLinks.length,
    imageCount: images.length,
    imagesWithAlt: imagesWithAlt.length,
    ctaButtonCount: ctaButtons.length,
    primaryCtaText,
    hasPhoneNumber: /(\+[\d\s\-()]{7,}|0[\d\s\-()]{8,})/.test(html),
    hasContactForm: lower.includes("contact") && (lower.includes("<form") || lower.includes("input type")),
    hasOnlineBooking: ["book", "booking", "schedule", "appointment", "calendly", "acuity", "mindbody"].some((k) =>
      lower.includes(k),
    ),
    pageSizeKb: Math.round(pageSizeBytes / 1024),
    loadTimeMs,
    hasLazyLoading: lower.includes('loading="lazy"') || lower.includes("lazyload"),
    hasCssMinified: !lower.includes("  .") && lower.includes("<link") && lower.includes(".css"),
    hasJsMinified: (html.match(/\.min\.js/i) ?? []).length > 0,
    hasSSL: url.startsWith("https://"),
    hasCookieBanner: ["cookie", "gdpr", "consent"].some((k) => lower.includes(k)),
    hasPrivacyPolicy: ["privacy", "privacy policy", "datapolicy"].some((k) => lower.includes(k)),
    hasReviewWidget: ["trustpilot", "google review", "reviews widget", "stars"].some((k) => lower.includes(k)),
    hasSocialProof: ["testimonial", "client said", "customer said", "⭐", "★"].some((k) => lower.includes(k)),
    hasViewportMeta: lower.includes("viewport"),
  };
}

function parseBrandSignals(html: string, input: Partial<DeepBrandInput> = {}): DeepBrandInput {
  const lower = html.toLowerCase();
  const wordCount = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ").length;

  return {
    wordCountHomepage: wordCount,
    hasAboutPage: lower.includes("/about") || lower.includes("about us") || lower.includes("about me"),
    hasTeamPage: lower.includes("/team") || lower.includes("meet the team") || lower.includes("our team"),
    hasCaseStudies: lower.includes("case study") || lower.includes("case studies"),
    hasPortfolio: lower.includes("/portfolio") || lower.includes("our work") || lower.includes("gallery"),
    hasBlogOrNews: lower.includes("/blog") || lower.includes("/news") || lower.includes("latest posts"),
    blogPostCount: (html.match(/<article/gi) ?? []).length,
    lastBlogPostDaysAgo: null,
    primaryPlatform: input.primaryPlatform ?? "none",
    postFrequencyPerWeek: input.postFrequencyPerWeek ?? null,
    hasVideoContent: lower.includes("<video") || lower.includes("youtube.com/embed") || lower.includes("vimeo.com"),
    hasUserGeneratedContent: lower.includes("ugc") || lower.includes("tagged us") || lower.includes("#"),
    averageEngagementRate: null,
    // All website signals require actual HTML — never true when page is empty/unreachable
    hasLogoInHeader: html.length > 0 && lower.includes("<header") && (lower.includes("logo") || lower.includes("<img")),
    colorSchemeConsistent: html.length > 0 && (lower.includes("background-color") || lower.includes("background:")),
    fontsConsistent: html.length > 0 && (html.includes("font-family") || html.includes("googleapis.com/css")),
    hasCustomDomain:
      html.length > 0 && !/(wordpress\.com|wix\.com|weebly\.com|squarespace\.com|webflow\.io)/.test(lower),
    usesGenericEmailProvider: html.length > 0 && /(gmail\.com|yahoo\.com|hotmail\.com|outlook\.com)/.test(lower),
  };
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function fetchPage(
  url: string,
): Promise<{ html: string; loadTimeMs: number; sizeBytes: number; error?: string } | null> {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const start = Date.now();

  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LeadGenOS/1.0; +https://leadgenos.com)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return { html: "", loadTimeMs: Date.now() - start, sizeBytes: 0, error: `HTTP ${res.status}` };

    const buffer = await res.arrayBuffer();
    const html = new TextDecoder().decode(buffer.slice(0, 400_000));
    return { html, loadTimeMs: Date.now() - start, sizeBytes: buffer.byteLength };
  } catch (e) {
    clearTimeout(timeout);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { html: "", loadTimeMs: Date.now() - start, sizeBytes: 0, error: msg };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // ── Quota check ──────────────────────────────────────────────────────────
    // Import here to avoid circular deps at module level
    const { getAuthUser } = await import("@/lib/supabaseServer");
    const { supabase } = await import("@/lib/supabaseClient");
    const { getEffectivePlan, deepEnrichmentLimit } = await import("@/lib/plan");

    const authUser = await getAuthUser();
    const userId = authUser?.id ?? null;
    const plan = getEffectivePlan();
    const limit = deepEnrichmentLimit(plan);

    if (limit === 0) {
      return NextResponse.json({ error: "Deep scan not available on your plan." }, { status: 403 });
    }

    // Enforce monthly quota for Operator (limit !== null means finite)
    if (limit !== null && supabase && userId) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("deep_scan_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", monthStart.toISOString());

      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          { error: `Monthly deep scan limit reached (${limit}/month). Upgrade to Agency for unlimited scans.` },
          { status: 429 },
        );
      }

      // Log this scan (fire-and-forget — don't block on it)
      supabase
        .from("deep_scan_usage")
        .insert({ user_id: userId })
        .then(() => {});
    }
    // ─────────────────────────────────────────────────────────────────────────

    const body = (await request.json()) as {
      website?: string | null;
      nearbyCompetitorCount?: number;
      nearbyWithWebsite?: number;
      nearbyHighRated?: number;
      nearbyHighReviewCount?: number;
      hasPricingPage?: boolean;
      priceKeywords?: string[];
      searchVolumeProxy?: "low" | "medium" | "high" | null;
      hasSeasonalDemand?: boolean;
      isEmergencyService?: boolean;
      primaryPlatform?: "instagram" | "facebook" | "tiktok" | "linkedin" | "none";
      postFrequencyPerWeek?: number | null;
    };

    const website = body.website?.trim() ?? null;

    // 1. Fetch page (if website provided)
    let html = "";
    let loadTimeMs = 0;
    let pageSizeBytes = 0;
    let fetchError: string | null = null;

    if (website) {
      const fetched = await fetchPage(website);
      if (fetched) {
        html = fetched.html;
        loadTimeMs = fetched.loadTimeMs;
        pageSizeBytes = fetched.sizeBytes;
        fetchError = fetched.error ?? null;
      }
    }

    const pageReachable = html.length > 0 && !fetchError;

    // 2. Parse website signals from HTML
    const websiteInput: DeepWebsiteInput = pageReachable
      ? parseWebsiteSignals(html, website ?? "", loadTimeMs, pageSizeBytes)
      : {
          hasH1: false,
          h1Count: 0,
          hasMetaDescription: false,
          metaDescriptionLength: null,
          internalLinkCount: 0,
          imageCount: 0,
          imagesWithAlt: 0,
          ctaButtonCount: 0,
          primaryCtaText: null,
          hasPhoneNumber: false,
          hasContactForm: false,
          hasOnlineBooking: false,
          pageSizeKb: null,
          loadTimeMs: null,
          hasLazyLoading: false,
          hasCssMinified: false,
          hasJsMinified: false,
          hasSSL: (website ?? "").startsWith("https://"),
          hasCookieBanner: false,
          hasPrivacyPolicy: false,
          hasReviewWidget: false,
          hasSocialProof: false,
          hasViewportMeta: false,
        };

    const websiteResult = extractDeepWebsiteSignals(websiteInput);

    // 3. Market signals (from caller-provided hints, or safe defaults)
    const marketInput: DeepMarketInput = {
      nearbyCompetitorCount: body.nearbyCompetitorCount ?? 8,
      nearbyWithWebsite: body.nearbyWithWebsite ?? 4,
      nearbyHighRated: body.nearbyHighRated ?? 3,
      nearbyHighReviewCount: body.nearbyHighReviewCount ?? 2,
      hasPricingPage: body.hasPricingPage ?? false,
      priceKeywords: body.priceKeywords ?? [],
      searchVolumeProxy: body.searchVolumeProxy ?? null,
      hasSeasonalDemand: body.hasSeasonalDemand ?? false,
      isEmergencyService: body.isEmergencyService ?? false,
    };

    const marketResult = extractDeepMarketSignals(marketInput);

    // 4. Brand signals (parsed from HTML + caller hints)
    const brandInput = parseBrandSignals(html, {
      primaryPlatform: body.primaryPlatform ?? "none",
      postFrequencyPerWeek: body.postFrequencyPerWeek ?? null,
    });

    const brandResult = extractDeepBrandSignals(brandInput);

    return NextResponse.json({
      success: true,
      pageReachable,
      fetchError,
      loadTimeMs,
      website: {
        scores: websiteResult.scores,
        summary: websiteResult.summary,
        signalCount: websiteResult.signals.length,
      },
      market: {
        scores: marketResult.scores,
        competitorSummary: marketResult.competitorSummary,
        recommendation: marketResult.recommendation,
        signalCount: marketResult.signals.length,
      },
      brand: {
        scores: brandResult.scores,
        brandGrade: brandResult.brandGrade,
        weakestArea: brandResult.weakestArea,
        strengthArea: brandResult.strengthArea,
        signalCount: brandResult.signals.length,
      },
      // Composite deep score (simple weighted average for now)
      deepScore: Math.round(
        websiteResult.scores.seoStructure * 0.15 +
          websiteResult.scores.ctaStrength * 0.25 +
          websiteResult.scores.pageSpeed * 0.1 +
          websiteResult.scores.trustLayer * 0.1 +
          marketResult.scores.opportunityWindow * 0.2 +
          brandResult.scores.brandConsistency * 0.1 +
          brandResult.scores.contentQuality * 0.1,
      ),
    });
  } catch (err) {
    console.error("/api/enrich/deep POST error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
