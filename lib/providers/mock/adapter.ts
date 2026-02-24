// lib/providers/mock/adapter.ts
import type { RawCompany } from "@/lib/types";
import type { ProviderAdapter, ProviderRecord, ProviderResult } from "../types";

type RequestedPresence = "low" | "medium" | "high" | "";

type MockSearchIntent = {
  query: string;
  limit?: number;
  requestId?: string;

  // optional fields your UI/API might send
  location?: string;
  socialPresence?: RequestedPresence;
};

export const mockAdapter: ProviderAdapter = {
  name: "mock",

  async search(intent: unknown): Promise<ProviderResult> {
    const i = (intent ?? {}) as Partial<MockSearchIntent>;

    const query = typeof i.query === "string" ? i.query : "";
    const count = Math.min(i.limit ?? 25, 10);

    const intentLocation =
      typeof i.location === "string" && i.location.trim() ? i.location.trim() : undefined;

    const requestedPresence: RequestedPresence =
      i.socialPresence === "low" ||
      i.socialPresence === "medium" ||
      i.socialPresence === "high" ||
      i.socialPresence === ""
        ? i.socialPresence
        : "";

    const records: ProviderRecord[] = Array.from({ length: count }).map((_, idx) => {
      const n = idx + 1;

      // Deterministic seed per query + location + index + presence (so filters actually change results)
      const seed = hashToInt(`${query}|${intentLocation ?? ""}|${requestedPresence}|${n}`);

      const source_id = `mock_${hashString(`${query}_${n}`)}`;

      const raw_payload = {
        provider: "mock",
        q: query,
        location: intentLocation ?? null,
        index: n,
        seed,
        requestedPresence: requestedPresence || null,
        generatedAt: new Date().toISOString(),
      };

      // Wider baseline distribution:
      // rating: 3.5–4.9
      // review_count: 0–320 (baseline), then presence shifts slightly
      // website: 40–80% depending on presence, but not guaranteed
      const baseRating = round1(clamp(3.5 + (seed % 150) / 100, 3.5, 4.9)); // 3.5..4.9
      const baseReviews = clampInt((seed % 360) - 20, 0, 320); // 0..320
      const baseHasWebsite = seed % 5 !== 0; // 80% baseline, but we’ll override per presence

      let rating = baseRating;
      let review_count = baseReviews;
      let website: string | undefined = baseHasWebsite ? `https://mock${n}.example.com` : undefined;

      // Presence shaping (do NOT over-inflate)
      if (requestedPresence === "low") {
        // Low presence: more likely no website, fewer reviews, rating can vary
        website = seed % 4 === 0 ? `https://mock${n}.example.com` : undefined; // ~25% still have a site
        review_count = clampInt(Math.floor(review_count * 0.45), 0, 140);
        rating = round1(clamp(rating - (seed % 3 === 0 ? 0.2 : 0.0), 3.5, 4.9));
      } else if (requestedPresence === "medium") {
        // Medium: usually a website, moderate reviews
        website = seed % 8 === 0 ? undefined : `https://mock${n}.example.com`; // ~87.5% have a site
        review_count = clampInt(Math.floor(review_count * 0.9 + 5), 10, 260);
        rating = round1(clamp(rating, 3.7, 4.8));
      } else if (requestedPresence === "high") {
        // High: often a website, higher reviews, but NOT always perfect
        website = seed % 6 === 0 ? undefined : `https://mock${n}.example.com`; // ~83% have a site
        review_count = clampInt(Math.floor(review_count * 1.15 + 20), 30, 340);
        // Some high-presence businesses still have average ratings
        rating = round1(clamp(rating - (seed % 7 === 0 ? 0.3 : 0.0), 3.6, 4.9));
      }

      // Add controlled "misfit/noise" rows so classifier confidence/fit isn't always high.
      // This is what creates real Long Shots for testing.
      const q = query.trim().toLowerCase();
      const misfitMode = seed % 10; // 0..9

      let categories: string[] = [];
      if (q.length > 0) {
        if (misfitMode === 0) {
          // Hard misfit: no query category at all
          categories = ["mock-category", "unrelated", "misc"];
        } else if (misfitMode === 1 || misfitMode === 2) {
          // Soft misfit: query present but diluted
          categories = [q, "mock-category", "misc"];
        } else {
          // Normal: query strongly represented
          categories = [q, "mock-category"];
        }
      } else {
        categories = ["mock-category"];
      }

      const company = {
        source: "mock",
        sourceId: source_id,
        name: `Mock Company ${n}`,
        categories,

        website,

        city: intentLocation,
        country: "SE",

        rating,
        review_count,

        rawPayload: raw_payload,
      } satisfies RawCompany;

      return {
        source: "mock",
        source_id,
        raw_payload,
        company,
      };
    });

    return {
      ok: true,
      records,
      meta: {
        provider: "mock",
        requestId: typeof i.requestId === "string" ? i.requestId : undefined,
        fetchedCount: records.length,
        returnedCount: records.length,
        exhausted: true,
        nextCursor: null,
      },
    };
  },
};

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function hashToInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}



