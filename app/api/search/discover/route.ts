// app/api/search/discover/route.ts

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { upsertCompaniesRaw } from "@/lib/ingest/db";
import { runPipelineForRaw } from "@/lib/ingest/pipeline";
import { getRawCompanyById, attachRawIdsToRun, finalizeProviderRun } from "@/lib/persistence";
import { ingestFromProvider } from "@/lib/ingest/ingest";
import type { ProviderRecord } from "@/lib/providers/types";
import type { RawCompany } from "@/lib/types";

type AIBusiness = {
  name: string;
  address?: string;
  city?: string;
  website?: string;
  phone?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
};

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

// ── Claude web search ────────────────────────────────────────────────────────

async function searchWithClaude(niche: string, city: string, country: string): Promise<AIBusiness[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[discover] No ANTHROPIC_API_KEY — skipping AI search");
    return [];
  }

  try {
    console.log(`[discover] Starting Claude web search: "${niche}" in "${city}"`);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: `You are a business research engine. Find real local businesses using web search.
Use the web_search tool multiple times with different queries to find as many businesses as possible.
Return ONLY a raw JSON array of businesses. No prose, no markdown, no explanation. Just the array.`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Find ${niche} businesses in ${city}, ${country}. Search multiple times with different queries to maximise coverage. Include businesses from Google Maps, Yelp, directories, and any other sources you find.

Return a JSON array:
[{"name":"Business Name","address":"Street address","city":"${city}","website":"https://...","phone":"+46...","category":"${niche}","rating":4.2,"reviewCount":45}]

Only include real businesses. Return as many as you can find.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[discover] Claude API error:", res.status, errText.slice(0, 200));
      return [];
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b: { type: string; text?: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text ?? "")
      .join("");

    console.log(`[discover] Claude response text length: ${text.length}`);

    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) {
      console.log("[discover] No JSON array found in Claude response");
      return [];
    }

    const parsed = JSON.parse(text.slice(arrayStart, arrayEnd + 1)) as unknown[];
    const businesses = parsed
      .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
      .filter((b) => typeof b.name === "string" && (b.name as string).trim().length > 0)
      .map((b) => ({
        name: String(b.name ?? "").trim(),
        address: typeof b.address === "string" ? b.address : undefined,
        city: typeof b.city === "string" ? b.city : city,
        website: typeof b.website === "string" ? (b.website as string) : undefined,
        phone: typeof b.phone === "string" ? b.phone : undefined,
        category: typeof b.category === "string" ? b.category : niche,
        rating: typeof b.rating === "number" ? (b.rating as number) : undefined,
        reviewCount: typeof b.reviewCount === "number" ? (b.reviewCount as number) : undefined,
      }));

    console.log(`[discover] Claude found ${businesses.length} businesses`);
    return businesses;
  } catch (err) {
    console.error("[discover] Claude search exception:", err);
    return [];
  }
}

// ── Google Places via ingest pipeline ────────────────────────────────────────

async function searchGooglePlaces(niche: string, city: string, socialPresence: string): Promise<number[]> {
  const queries = [niche, `${niche} ${city}`, `${niche} i ${city}`, `bästa ${niche} ${city}`];
  const runIds: number[] = [];

  console.log(`[discover] Running ${queries.length} Google Places queries`);

  await Promise.allSettled(
    queries.map(async (query) => {
      try {
        const summary = await ingestFromProvider({
          provider: "google_places",
          query,
          location: city,
          country: "Sweden",
          socialPresence: (socialPresence as "any") ?? "any",
          limit: 20,
        });
        if (summary.runId) {
          runIds.push(summary.runId);
          console.log(
            `[discover] Google Places query "${query}" → runId ${summary.runId}, ${summary.returnedCount} results`,
          );
        }
      } catch (err) {
        console.error(`[discover] Google Places query "${query}" failed:`, err);
      }
    }),
  );

  return runIds;
}

// ── Ingest AI results ────────────────────────────────────────────────────────

async function ingestAIResults(businesses: AIBusiness[], niche: string, city: string): Promise<number | null> {
  if (!supabase || businesses.length === 0) return null;

  // Deduplicate AI results before ingesting
  const seenNames = new Set<string>();
  const seenDomains = new Set<string>();
  const records: ProviderRecord[] = [];

  for (let i = 0; i < businesses.length; i++) {
    const b = businesses[i];
    const name = normaliseName(b.name);
    const domain = extractDomain(b.website);
    if (seenNames.has(name)) continue;
    if (domain && seenDomains.has(domain)) continue;
    seenNames.add(name);
    if (domain) seenDomains.add(domain);

    const sourceId = `ai_${niche}_${city}_${i}_${name.replace(/\s+/g, "_").slice(0, 20)}`.toLowerCase();
    const company: RawCompany = {
      source: "google_places",
      sourceId,
      name: b.name,
      categories: b.category ? [b.category] : [niche],
      website: b.website,
      city: b.city ?? city,
      country: "SE",
      rating: b.rating,
      review_count: b.reviewCount,
      rawPayload: b,
    };
    records.push({ source: "google_places", source_id: sourceId, raw_payload: b, company });
  }

  if (records.length === 0) return null;

  try {
    // Create a run row for AI results
    const intentHash = `ai_${Date.now()}_${niche}_${city}`.replace(/\s+/g, "_").toLowerCase().slice(0, 60);
    const { data: runRow, error: runErr } = await supabase
      .from("provider_runs")
      .insert({
        provider: "google_places",
        intent_hash: intentHash,
        intent: { provider: "google_places", query: `${niche} ${city} [AI Discovery]`, location: city },
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runErr || !runRow?.id) {
      console.error("[discover] Failed to create AI run:", runErr?.message);
      return null;
    }

    const aiRunId = runRow.id as number;

    const { rawIdsBySourceId, insertedRaw } = await upsertCompaniesRaw(records);
    const rawIds = Object.values(rawIdsBySourceId);
    await attachRawIdsToRun(aiRunId, rawIds);

    for (const rawId of rawIds) {
      const raw = await getRawCompanyById(rawId);
      if (raw) await runPipelineForRaw(rawId, raw);
    }

    await finalizeProviderRun({
      runId: aiRunId,
      status: "success",
      fetchedCount: records.length,
      returnedCount: insertedRaw,
      insertedRaw,
      skippedDuplicates: records.length - insertedRaw,
      nextCursor: null,
      exhausted: true,
    });

    console.log(`[discover] AI run ${aiRunId} created with ${insertedRaw} records`);
    return aiRunId;
  } catch (err) {
    console.error("[discover] AI ingest failed:", err);
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      niche?: string;
      city?: string;
      country?: string;
      socialPresence?: string;
    };

    const niche = body.niche?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const country = body.country ?? "Sweden";
    const socialPresence = body.socialPresence ?? "any";

    if (!niche || !city) {
      return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
    }

    console.log(`[discover] Search: "${niche}" in "${city}"`);

    // Run Claude AI search + Google Places in parallel
    const [aiBusinesses, googleRunIds] = await Promise.all([
      searchWithClaude(niche, city, country),
      searchGooglePlaces(niche, city, socialPresence),
    ]);

    // Ingest AI results into the pipeline
    const aiRunId = await ingestAIResults(aiBusinesses, niche, city);

    // Combine all run IDs — Google Places first (more reliable), AI results appended
    const allRunIds = [...googleRunIds, ...(aiRunId ? [aiRunId] : [])].filter(Boolean);

    console.log(
      `[discover] Complete. Google runs: ${googleRunIds.length}, AI run: ${aiRunId ?? "none"}, total runs: ${allRunIds.length}`,
    );

    if (allRunIds.length === 0) {
      return NextResponse.json({ ok: false, runIds: [], primaryRunId: null, error: "No results from any source" });
    }

    return NextResponse.json({
      ok: true,
      runIds: allRunIds,
      primaryRunId: allRunIds[0],
      aiResultCount: aiBusinesses.length,
      googleRunCount: googleRunIds.length,
    });
  } catch (err) {
    console.error("[/api/search/discover] Unhandled error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
