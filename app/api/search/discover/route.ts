// app/api/search/discover/route.ts
//
// Unified lead discovery engine.
//
// Standard search (free, default):
//   Google Places + SERP run in parallel with 3-4 query variants each.
//   Fast (~5s), no AI cost, solid coverage.
//
// Deep search (credit-gated, Operator/Agency):
//   Claude Haiku generates 8-12 smart query variants (local language, synonyms,
//   districts). Those queries are fired through Google Places + SERP.
//   Better recall, ~15s, costs ~$0.002 in Haiku tokens per search.
//   Gated by deep_search_usage table (same pattern as deep enrichment).

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { ingestFromProvider } from "@/lib/ingest/ingest";
import { getEffectivePlan, deepSearchLimit } from "@/lib/plan";
import { getAuthUser } from "@/lib/supabaseServer";

// ── Haiku query planner (deep search only) ────────────────────────────────────

async function generateQueryVariants(
  niche: string,
  city: string,
  country: string,
  language: string,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [niche, `${niche} ${city}`];

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: `You are a search query generator. Return ONLY a JSON array of strings. No explanation.`,
        messages: [
          {
            role: "user",
            content: `Generate 8-10 search queries to find "${niche}" businesses in ${city}, ${country}.
Include: the original term, local language synonyms, common alternative names, and 2-3 specific district/area queries for ${city}.
Language hint: ${language}.
Return ONLY: ["query1","query2",...] — raw JSON array, nothing else.`,
          },
        ],
      }),
    });

    if (!res.ok) return [niche, `${niche} ${city}`];

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content ?? []).find((b) => b.type === "text")?.text?.trim() ?? "";
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return [niche, `${niche} ${city}`];

    const parsed = JSON.parse(clean.slice(start, end + 1)) as unknown[];
    const queries = parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
    console.log(`[discover] Haiku generated ${queries.length} query variants`);
    return queries.length > 0 ? queries : [niche, `${niche} ${city}`];
  } catch (err) {
    console.error("[discover] Haiku query generation failed:", err);
    return [niche, `${niche} ${city}`];
  }
}

// ── Multi-provider search ─────────────────────────────────────────────────────

async function runQueries(queries: string[], city: string, socialPresence: string): Promise<number[]> {
  const runIds: number[] = [];

  await Promise.allSettled(
    queries.flatMap((query) => [
      // Google Places
      ingestFromProvider({
        provider: "google_places",
        query,
        location: city,
        country: "Sweden",
        socialPresence: socialPresence as "any",
        limit: 20,
      })
        .then((s) => {
          if (s.runId) runIds.push(s.runId);
        })
        .catch(() => {}),

      // SERP (Google Maps via SerpApi) — only if key is configured
      ...(process.env.SERP_API_KEY
        ? [
            ingestFromProvider({
              provider: "serp",
              query,
              location: city,
              country: "Sweden",
              socialPresence: socialPresence as "any",
              limit: 20,
            })
              .then((s) => {
                if (s.runId) runIds.push(s.runId);
              })
              .catch(() => {}),
          ]
        : []),
    ]),
  );

  return runIds;
}

// ── Deep search usage check ───────────────────────────────────────────────────

async function checkAndLogDeepSearchUsage(userId: string | null): Promise<{
  allowed: boolean;
  remaining: number | null;
}> {
  const plan = getEffectivePlan();
  const limit = deepSearchLimit(plan);

  if (limit === 0) return { allowed: false, remaining: 0 };
  if (limit === null) return { allowed: true, remaining: null }; // unlimited

  if (!supabase || !userId) return { allowed: true, remaining: limit }; // dev fallback

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("deep_search_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  const used = count ?? 0;
  if (used >= limit) return { allowed: false, remaining: 0 };

  // Log this usage (fire-and-forget)
  supabase
    .from("deep_search_usage")
    .insert({ user_id: userId })
    .then(() => {});

  return { allowed: true, remaining: limit - used - 1 };
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
      searchMode?: "standard" | "deep";
    };

    const niche = body.niche?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const country = body.country ?? "Sweden";
    const language = body.language ?? "sv";
    const socialPresence = body.socialPresence ?? "any";
    const searchMode = body.searchMode ?? "standard";

    if (!niche || !city) {
      return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
    }

    console.log(`[discover] mode=${searchMode} niche="${niche}" city="${city}"`);

    let queries: string[];

    if (searchMode === "deep") {
      // Check credits
      const authUser = await getAuthUser();
      const userId = authUser?.id ?? null;
      const usage = await checkAndLogDeepSearchUsage(userId);

      if (!usage.allowed) {
        return NextResponse.json(
          {
            error: "Deep search limit reached for this month. Upgrade your plan for more.",
            code: "DEEP_SEARCH_LIMIT",
          },
          { status: 429 },
        );
      }

      // Generate smart query variants with Haiku
      const aiQueries = await generateQueryVariants(niche, city, country, language);
      queries = aiQueries;

      return NextResponse.json(await executeAndRespond(queries, city, socialPresence, searchMode, usage.remaining));
    } else {
      // Standard — fixed set of query variants, no AI cost
      queries = [niche, `${niche} ${city}`, `${niche} i ${city}`, `bästa ${niche} ${city}`];

      return NextResponse.json(await executeAndRespond(queries, city, socialPresence, searchMode, null));
    }
  } catch (err) {
    console.error("[/api/search/discover]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function executeAndRespond(
  queries: string[],
  city: string,
  socialPresence: string,
  searchMode: string,
  deepRemaining: number | null,
) {
  const runIds = await runQueries(queries, city, socialPresence);
  console.log(`[discover] ${queries.length} queries → ${runIds.length} runs`);

  if (runIds.length === 0) {
    return { ok: false, runIds: [], primaryRunId: null, searchMode };
  }

  return {
    ok: true,
    runIds,
    primaryRunId: runIds[0],
    queryCount: queries.length,
    searchMode,
    ...(deepRemaining !== null ? { deepSearchesRemaining: deepRemaining } : {}),
  };
}
