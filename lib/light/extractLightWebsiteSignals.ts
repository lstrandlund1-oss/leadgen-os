import { buildSignal } from "@/lib/signals/evidence";
import type { Signal } from "@/lib/signals/signalTypes";

export interface WebsiteSignalResult {
  signals: Signal[];
  reachable: boolean;
  fetchedUrl: string | null;
  errorReason?: string;
}

// Keywords that suggest a contact page exists
const CONTACT_PATTERNS = [
  /contact/i, /kontakt/i, /reach\s*us/i, /get\s*in\s*touch/i, /hjälp/i,
];

// Keywords that suggest a booking or inquiry CTA
const BOOKING_PATTERNS = [
  /book\s*(now|a|an)?/i, /boka/i, /schedule/i, /reserve/i,
  /request\s*(a\s*)?(quote|call|demo)/i, /get\s*(a\s*)?(quote|started)/i,
  /free\s*consult/i, /book\s*appointment/i,
];

// Keywords that suggest a clear service offer
const OFFER_PATTERNS = [
  /we\s*(offer|provide|specialize|help)/i,
  /our\s*(services|solutions|packages)/i,
  /what\s*we\s*do/i, /how\s*it\s*works/i,
  /tjänster/i, /vi\s*erbjuder/i,
];

// Meta viewport = mobile-friendly intent
const MOBILE_VIEWPORT_PATTERN = /viewport/i;

function detectPattern(html: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(html));
}

function extractMetaTags(html: string): boolean {
  return (
    /<meta\s[^>]*name=["']description["']/i.test(html) ||
    /<meta\s[^>]*property=["']og:/i.test(html)
  );
}

export async function extractLightWebsiteSignals(
  websiteUrl: string | null,
): Promise<WebsiteSignalResult> {
  // No website = all signals absent
  if (!websiteUrl || websiteUrl.trim().length === 0) {
    return {
      reachable: false,
      fetchedUrl: null,
      errorReason: "no_url",
      signals: [
        buildSignal({ key: "website_has_contact_page", value: false, confidence: 95 }),
        buildSignal({ key: "website_has_booking_cta", value: false, confidence: 95 }),
        buildSignal({ key: "website_has_clear_offer", value: false, confidence: 95 }),
        buildSignal({ key: "website_mobile_friendly", value: false, confidence: 95 }),
      ],
    };
  }

  // Normalize URL
  let url = websiteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let html = "";
  let reachable = false;
  let errorReason: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadGenOS/1.0; +https://leadgenos.com)",
        Accept: "text/html",
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      // Read max 200KB — enough to detect signals without wasting memory
      const buffer = await res.arrayBuffer();
      const text = new TextDecoder().decode(buffer.slice(0, 200_000));
      html = text;
      reachable = true;
    } else {
      errorReason = `http_${res.status}`;
    }
  } catch (err) {
    errorReason = err instanceof Error && err.name === "AbortError"
      ? "timeout"
      : "fetch_failed";
  }

  if (!reachable) {
    return {
      reachable: false,
      fetchedUrl: url,
      errorReason,
      signals: [
        buildSignal({ key: "website_has_contact_page", value: null, confidence: 10 }),
        buildSignal({ key: "website_has_booking_cta", value: null, confidence: 10 }),
        buildSignal({ key: "website_has_clear_offer", value: null, confidence: 10 }),
        buildSignal({ key: "website_mobile_friendly", value: null, confidence: 10 }),
      ],
    };
  }

  // Detect signals from HTML
  const hasContactPage = detectPattern(html, CONTACT_PATTERNS);
  const hasBookingCta = detectPattern(html, BOOKING_PATTERNS);
  const hasClearOffer = detectPattern(html, OFFER_PATTERNS);
  const isMobileFriendly = MOBILE_VIEWPORT_PATTERN.test(html);

  return {
    reachable: true,
    fetchedUrl: url,
    signals: [
      buildSignal({ key: "website_has_contact_page", value: hasContactPage, confidence: 80 }),
      buildSignal({ key: "website_has_booking_cta", value: hasBookingCta, confidence: 80 }),
      buildSignal({ key: "website_has_clear_offer", value: hasClearOffer, confidence: 75 }),
      buildSignal({ key: "website_mobile_friendly", value: isMobileFriendly, confidence: 90 }),
    ],
  };
}