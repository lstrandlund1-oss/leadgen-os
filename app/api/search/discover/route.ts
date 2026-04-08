// app/api/search/discover/route.ts
//
// Unified AI + Google Places discovery.
// Runs Claude web search to find businesses across multiple sources,
// while Google Places runs in parallel for structured data.
// All results are merged, deduped, and stored through the existing pipeline.
// Returns a single runId for the client to fetch leads from.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { upsertCompaniesRaw } from "@/lib/ingest/db";
import { runPipelineForRaw } from "@/lib/ingest/pipeline";
import { getRawCompanyById, attachRawIdsToRun, finalizeProviderRun } from "@/lib/persistence";
import type { ProviderRecord } from "@/lib/providers/types";
import type { RawCompany } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  if (!apiKey) return [];

  try {
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
        system: `You are a business research engine. Find real, currently operating local businesses.
Use web_search multiple times with different queries to maximise coverage.
Return ONLY a raw JSON array. No prose, no markdown. Just the array.`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [
          {
            role: "user",
            content: `Find as many ${niche} businesses as possible in ${city}, ${country}.

Search strategy:
1. "${niche} ${city}"
2. Local language variations of "${niche}" in ${city}  
3. "${niche}" in specific districts/areas of ${city}
4. Search on Google Maps, directories, review sites

Return a JSON array with all businesses found:
[{"name":"...","address":"...","city":"${city}","website":"...","phone":"...","category":"${niche}","rating":4.2,"reviewCount":45}]

Only include real businesses you actually found. Include as many as possible.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[discover] Claude error:", res.status);
      return [];
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    if (!text) return [];

    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const arrayStart = clean.indexOf("[");
    const arrayEnd = clean.lastIndexOf("]");
    if (arrayStart === -1 || arrayEnd === -1) return [];

    const parsed = JSON.parse(clean.slice(arrayStart, arrayEnd + 1)) as unknown[];
    return parsed
      .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
      .filter((b) => typeof b.name === "string" && (b.name as string).trim().length > 0)
      .map((b) => ({
        name: String(b.name ?? "").trim(),
        address: typeof b.address === "string" ? b.address : undefined,
        city: typeof b.city === "string" ? b.city : city,
        website:
          typeof b.website === "string" && (b.website as string).startsWith("http") ? (b.website as string) : undefined,
        phone: typeof b.phone === "string" ? b.phone : undefined,
        category: typeof b.category === "string" ? b.category : niche,
        rating: typeof b.rating === "number" ? (b.rating as number) : undefined,
        reviewCount: typeof b.reviewCount === "number" ? (b.reviewCount as number) : undefined,
      }));
  } catch (err) {
    console.error("[discover] Claude search failed:", err);
    return [];
  }
}

// ── Google Places via existing search endpoint ────────────────────────────────

async function searchGooglePlaces(niche: string, city: string, socialPresence: string): Promise<number[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const queries = [niche, `${niche} ${city}`, `${niche} i ${city}`];
  const runIds: number[] = [];

  await Promise.allSettled(
    queries.map(async (query) => {
      try {
        const res = await fetch(`${baseUrl}/api/providers/search`, {
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
        /* silent */
      }
    }),
  );

  return runIds;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      niche?: string;
      city?: string;
      country?: string;
      language?: string;
      socialPresence?: string;
    };

    const niche = body.niche?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const country = body.country ?? "Sweden";
    const socialPresence = body.socialPresence ?? "any";

    if (!niche || !city) {
      return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
    }

    // Run Claude + Google Places in parallel
    const [aiResult, googleRunIds] = await Promise.all([
      searchWithClaude(niche, city, country),
      searchGooglePlaces(niche, city, socialPresence),
    ]);

    // Convert AI results to ProviderRecords
    const seenIds = new Set<string>();
    const seenDoms = new Set<string>();
    const seenNames = new Set<string>();

    const aiRecords: ProviderRecord[] = [];
    for (let i = 0; i < aiResult.length; i++) {
      const b = aiResult[i];
      const name = normaliseName(b.name);
      const domain = extractDomain(b.website);
      if (seenNames.has(name)) continue;
      if (domain && seenDoms.has(domain)) continue;
      seenNames.add(name);
      if (domain) seenDoms.add(domain);

      const sourceId = `ai_${Date.now()}_${i}_${name.replace(/\s+/g, "_").slice(0, 25)}`;
      if (seenIds.has(sourceId)) continue;
      seenIds.add(sourceId);

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
      aiRecords.push({ source: "google_places", source_id: sourceId, raw_payload: b, company });
    }

    // Create a dedicated run for AI results and ingest them
    let aiRunId: number | null = null;
    if (aiRecords.length > 0 && supabase) {
      const intentHash = `ai_${niche}_${city}_${Date.now()}`.replace(/\s+/g, "_").toLowerCase();
      const { data: runRow } = await supabase
        .from("provider_runs")
        .insert({
          provider: "google_places",
          intent_hash: intentHash,
          intent: { provider: "google_places", query: `${niche} ${city} [AI]`, location: city },
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      aiRunId = runRow?.id ?? null;

      if (aiRunId) {
        const { rawIdsBySourceId, insertedRaw } = await upsertCompaniesRaw(aiRecords);
        const rawIds = Object.values(rawIdsBySourceId);
        await attachRawIdsToRun(aiRunId, rawIds);

        // Run pipeline for each new record
        for (const rawId of rawIds) {
          const raw = await getRawCompanyById(rawId);
          if (raw) await runPipelineForRaw(rawId, raw);
        }

        await finalizeProviderRun({
          runId: aiRunId,
          status: "success",
          fetchedCount: aiRecords.length,
          returnedCount: insertedRaw,
          insertedRaw,
          skippedDuplicates: aiRecords.length - insertedRaw,
          nextCursor: null,
          exhausted: true,
        });
      }
    }

    const allRunIds = [...(aiRunId ? [aiRunId] : []), ...googleRunIds];

    return NextResponse.json({
      ok: true,
      runIds: allRunIds,
      primaryRunId: allRunIds[0] ?? null,
      aiResultCount: aiRecords.length,
      googleRunCount: googleRunIds.length,
    });
  } catch (err) {
    console.error("[/api/search/discover]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
