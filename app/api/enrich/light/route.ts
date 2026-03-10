import { NextResponse } from "next/server";
import { extractLightWebsiteSignals } from "@/lib/light/extractLightWebsiteSignals";
import { extractLightGoogleSignals } from "@/lib/light/extractLightGoogleSignals";
import { extractLightSocialSignals } from "@/lib/light/extractLightSocialSignals";
import { mergeSignals } from "@/lib/signals/mergeSignals";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      website,
      reviewCount,
      rating,
      ownerResponseCount,
      socialPresence,
      isGoodFit,
      classificationConfidence,
      riskProfile,
      fitScore,
    }: {
      website?: string | null;
      reviewCount?: number | null;
      rating?: number | null;
      ownerResponseCount?: number | null;
      socialPresence?: "low" | "medium" | "high";
      isGoodFit?: boolean;
      classificationConfidence?: number | null;
      riskProfile?: string;
      fitScore?: number | null;
    } = body;

    // 1) Website signals (fetches the actual site)
    const websiteResult = await extractLightWebsiteSignals(website ?? null);

    // 2) Google signals (derived from existing data — no fetch needed)
    const googleResult = extractLightGoogleSignals({
      reviewCount: reviewCount ?? null,
      rating: rating ?? null,
      ownerResponseCount: ownerResponseCount ?? null,
    });

    // 3) Social signals (extracted from the HTML we already fetched)
    const socialResult = extractLightSocialSignals(
      websiteResult.reachable
        ? await fetchHtmlForSocial(website ?? null)
        : null,
    );

    // 4) Merge all signals into a unified SignalSet
    const allSignals = [
      ...websiteResult.signals,
      ...googleResult.signals,
      ...socialResult.signals,
    ];

    const signalSet = mergeSignals(allSignals);

    // 5) Rescore using enriched signals
    const { rescoreWithLightSignals } =
      await import("@/lib/scoring/rescoreWithSignals");

    const websiteSignals = signalSet.byKey;
    const updatedScore = rescoreWithLightSignals({
      rating: body.rating ?? null,
      reviewCount: body.reviewCount ?? null,
      hasWebsite: !!(body.website && body.website.trim().length > 0),
      socialPresence: body.socialPresence ?? "low",
      isGoodFit: body.isGoodFit ?? false,
      classificationConfidence: body.classificationConfidence ?? null,
      riskProfile: body.riskProfile ?? "unknown",
      fitScore: typeof body.fitScore === "number" ? body.fitScore : undefined,

      websiteReachable: websiteResult.reachable,
      hasContactPage:
        (websiteSignals["website_has_contact_page"]?.value as boolean) ?? null,
      hasBookingCta:
        (websiteSignals["website_has_booking_cta"]?.value as boolean) ?? null,
      hasClearOffer:
        (websiteSignals["website_has_clear_offer"]?.value as boolean) ?? null,
      isMobileFriendly:
        (websiteSignals["website_mobile_friendly"]?.value as boolean) ?? null,
      socialPlatformCount: socialResult.detectedPlatforms.length,
      ownerResponds:
        (googleResult.signals.find((s) => s.key === "owner_response_presence")
          ?.value as boolean) ?? null,
    });

    return NextResponse.json({
      success: true,
      reachable: websiteResult.reachable,
      fetchedUrl: websiteResult.fetchedUrl,
      errorReason: websiteResult.errorReason ?? null,
      detectedPlatforms: socialResult.detectedPlatforms,
      signals: signalSet,
      updatedScore,
    });
  } catch (err) {
    console.error("/api/enrich/light POST error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 },
    );
  }
}

// Small helper — fetches HTML specifically for social signal extraction.
// We do this as a second fetch because extractLightWebsiteSignals doesn't
// expose its raw HTML (it only returns signals). Kept lightweight — 200KB cap.
async function fetchHtmlForSocial(url: string | null): Promise<string | null> {
  if (!url) return null;

  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadGenOS/1.0; +https://leadgenos.com)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    return new TextDecoder().decode(buffer.slice(0, 200_000));
  } catch {
    return null;
  }
}