// app/api/search/discover/route.ts
//
// AI-powered lead discovery engine.
// Runs Claude web search + Google Places in parallel, merges results,
// deduplicates by sourceId / website domain / name, ingests everything
// through the existing pipeline, and returns all scored leads at once.
//
// The client waits for this single response — no partial results, no
// background expansion. Everything arrives together.

import { NextResponse } from "next/server";
import { ingestFromProvider } from "@/lib/ingest/ingest";
import { getEffectivePlan } from "@/lib/plan";
import type { ProviderRecord } from "@/lib/providers/types";
import type { RawCompany } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type DiscoverRequest = {
  niche: string;
  city: string;
  country?: string;
  language?: string;
  socialPresence?: string;
};

type AIBusiness = {
  name: string;
  address?: string;
  city?: string;
  website?: string;
  phone?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  source?: string;
};

// ── Claude web search ─────────────────────────────────────────────────────────

async function searchWithClaude(
  niche: string,
  city: string,
  country: string,
  language: string,
  searchMode: "standard" | "deep",
): Promise<AIBusiness[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const targetCount = searchMode === "deep" ? 100 : 50;

  const systemPrompt = `You are a business research engine. Your job is to find real, currently operating local businesses.
You MUST use the web_search tool multiple times to find as many businesses as possible.
Search using different query variations to maximise coverage.
Return ONLY a JSON array of businesses. No prose, no markdown, no explanation. Raw JSON array only.`;

  const userPrompt = `Find ${targetCount}+ ${niche} businesses in ${city}, ${country}.

Search strategy:
1. Search "${niche} ${city}" 
2. Search "${niche} ${city} ${language === "sv" ? "stockholm" : city}" with local language terms
3. Search specific districts/areas of ${city}
4. Search review sites and directories (Google Maps, Yelp, TripAdvisor, Facebook)
5. Keep searching with variations until you have ${targetCount}+ unique businesses

For each business found, extract:
- name (business name)
- address (street address if available)
- city
- website (URL if available)
- phone (if available)  
- category (type of business)
- rating (1-5 if available)
- reviewCount (number of reviews if available)
- source (where you found it: "google_maps", "yelp", "facebook", "directory" etc)

Return a JSON array: [{"name":"...","address":"...","city":"...","website":"...","phone":"...","category":"...","rating":4.2,"reviewCount":45,"source":"google_maps"}, ...]

Include ONLY real businesses you actually found via search. No made-up results.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", // Sonnet for web search capability
        max_tokens: 8000,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      console.error("[discover] Claude API error:", res.status, await res.text());
      return [];
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };

    // Extract text blocks — Claude returns text after using tools
    const textBlocks = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join("");

    if (!textBlocks) return [];

    // Parse JSON — strip any accidental markdown
    const clean = textBlocks
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    // Find JSON array in the response
    const arrayStart = clean.indexOf("[");
    const arrayEnd = clean.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) return [];

    const jsonStr = clean.slice(arrayStart, arrayEnd + 1);
    const parsed = JSON.parse(jsonStr) as unknown[];

    return parsed
      .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
      .filter((b) => typeof b.name === "string" && b.name.trim().length > 0)
      .map((b) => ({
        name: String(b.name ?? "").trim(),
        address: typeof b.address === "string" ? b.address : undefined,
        city: typeof b.city === "string" ? b.city : city,
        website: typeof b.website === "string" ? b.website : undefined,
        phone: typeof b.phone === "string" ? b.phone : undefined,
        category: typeof b.category === "string" ? b.category : niche,
        rating: typeof b.rating === "number" ? b.rating : undefined,
        reviewCount: typeof b.reviewCount === "number" ? b.reviewCount : undefined,
        source: typeof b.source === "string" ? b.source : "ai_search",
      }));
  } catch (err) {
    console.error("[discover] Claude search failed:", err);
    return [];
  }
}

// ── Google Places search ───────────────────────────────────────────────────────

async function searchWithGooglePlaces(
  niche: string,
  city: string,
  socialPresence: string,
): Promise<{ runIds: number[]; queryCount: number }> {
  const queries = [niche, `${niche} ${city}`, `${niche} i ${city}`, `bästa ${niche} ${city}`];
  const runIds: number[] = [];

  await Promise.allSettled(
    queries.map(async (query) => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/providers/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "google_places",
            query,
            country: "Sweden",
            location: city,
            socialPresence,
            limit: 20,
            forceRefresh: true,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { runId?: number };
        if (typeof data.runId === "number") runIds.push(data.runId);
      } catch {
        // silent
      }
    }),
  );

  return { runIds, queryCount: queries.length };
}

// ── Convert AI business to ProviderRecord ─────────────────────────────────────

function aiBusinessToRecord(b: AIBusiness, index: number): ProviderRecord {
  const sourceId = `ai_${Date.now()}_${index}_${b.name.toLowerCase().replace(/\s+/g, "_").slice(0, 30)}`;

  const company: RawCompany = {
    source: "google_places", // reuse existing source type for pipeline compatibility
    sourceId,
    name: b.name,
    categories: b.category ? [b.category] : [],
    website: b.website,
    city: b.city,
    country: "SE",
    rating: b.rating,
    review_count: b.reviewCount,
    rawPayload: b,
  };

  return {
    source: "google_places",
    source_id: sourceId,
    raw_payload: b,
    company,
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9åäöüéàñ\s]/g, "")
    .replace(/\s+/g, " ");
}

function dedupeRecords(records: ProviderRecord[]): ProviderRecord[] {
  const seenIds = new Set<string>();
  const seenDomains = new Set<string>();
  const seenNames = new Set<string>();
  const result: ProviderRecord[] = [];

  for (const r of records) {
    const id = r.source_id;
    const domain = extractDomain(r.company.website);
    const name = normaliseName(r.company.name);

    if (seenIds.has(id)) continue;
    if (domain && seenDomains.has(domain)) continue;
    if (seenNames.has(name)) continue;

    seenIds.add(id);
    if (domain) seenDomains.add(domain);
    seenNames.add(name);
    result.push(r);
  }

  return result;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DiscoverRequest;
    const niche = body.niche?.trim() ?? "";
    const city = body.city?.trim() ?? "";

    if (!niche || !city) {
      return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
    }

    const country = body.country ?? "Sweden";
    const language = body.language ?? "sv";
    const socialPresence = body.socialPresence ?? "any";
    const plan = getEffectivePlan();
    const searchMode = plan === "scout" ? "standard" : "deep";

    // ── Run Claude + Google Places in parallel ──────────────────────────────
    const [aiResults, googleResult] = await Promise.allSettled([
      searchWithClaude(niche, city, country, language, searchMode),
      searchWithGooglePlaces(niche, city, socialPresence),
    ]);

    const aiBusinesses: AIBusiness[] = aiResults.status === "fulfilled" ? aiResults.value : [];
    const googleRunIds: number[] = googleResult.status === "fulfilled" ? googleResult.value.runIds : [];

    // ── Convert AI results to provider records ──────────────────────────────
    const aiRecords: ProviderRecord[] = aiBusinesses.map((b, i) => aiBusinessToRecord(b, i));

    // ── Ingest AI records through the existing pipeline ─────────────────────
    let aiRunId: number | null = null;
    if (aiRecords.length > 0) {
      const aiIngestSummary = await ingestFromProvider({
        provider: "google_places",
        query: `${niche} ${city} [AI]`,
        location: city,
        country,
        socialPresence: socialPresence as "any",
      });
      aiRunId = aiIngestSummary.runId ?? null;

      // Manually upsert AI records since ingestFromProvider uses the provider search
      // We need to write AI records directly
      const { upsertCompaniesRaw } = await import("@/lib/ingest/db");
      const { attachRawIdsToRun, getRawCompanyById } = await import("@/lib/persistence");
      const { runPipelineForRaw } = await import("@/lib/ingest/pipeline");

      const deduped = dedupeRecords(aiRecords);
      const { rawIdsBySourceId } = await upsertCompaniesRaw(deduped);
      const rawIds = Object.values(rawIdsBySourceId);
      if (aiRunId) await attachRawIdsToRun(aiRunId, rawIds);
      for (const rawId of rawIds) {
        const raw = await getRawCompanyById(rawId);
        if (raw) await runPipelineForRaw(rawId, raw);
      }
    }

    // ── Collect all run IDs ─────────────────────────────────────────────────
    const allRunIds = [...(aiRunId ? [aiRunId] : []), ...googleRunIds].filter(Boolean);

    return NextResponse.json({
      ok: true,
      runIds: allRunIds,
      primaryRunId: allRunIds[0] ?? null,
      aiResultCount: aiBusinesses.length,
      googleRunCount: googleRunIds.length,
      searchMode,
    });
  } catch (err) {
    console.error("[/api/search/discover]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
