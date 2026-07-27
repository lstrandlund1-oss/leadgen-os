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
import { recordUserSearchRuns } from "@/lib/userSearchRuns";
import {
  beginBetaGatedAction,
  finishBetaGatedAction,
  abortBetaGatedAction,
  betaBlockedResponseBody,
} from "@/lib/beta/gate";
import { logEvent } from "@/lib/analytics/log";
import { isAiGenerationEnabled, AI_DISABLED_RESPONSE } from "@/lib/killSwitch";
import { computeRealCostMicroUsd } from "@/lib/ai/cost";

// ── Haiku query planner (deep search only) ────────────────────────────────────

async function generateQueryVariants(
  niche: string,
  city: string,
  country: string,
  language: string,
): Promise<{ queries: string[]; aiSucceeded: boolean; usage?: { inputTokens: number; outputTokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = { queries: [niche, `${niche} ${city}`], aiSucceeded: false };
  if (!apiKey) return fallback;

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

    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = (data.content ?? []).find((b) => b.type === "text")?.text?.trim() ?? "";
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start === -1 || end === -1) return fallback;

    const parsed = JSON.parse(clean.slice(start, end + 1)) as unknown[];
    const queries = parsed.filter((q): q is string => typeof q === "string" && q.trim().length > 0);
    console.log(`[discover] Haiku generated ${queries.length} query variants`);
    return queries.length > 0
      ? {
          queries,
          aiSucceeded: true,
          usage: data.usage
            ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
            : undefined,
        }
      : fallback;
  } catch (err) {
    console.error("[discover] Haiku query generation failed:", err);
    return fallback;
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
    const langForI18n = language === "en" ? "en" : "sv";
    const socialPresence = body.socialPresence ?? "any";
    const searchMode = body.searchMode ?? "standard";

    if (!niche || !city) {
      return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
    }

    console.log(`[discover] mode=${searchMode} niche="${niche}" city="${city}"`);

    let queries: string[];

    if (searchMode === "deep") {
      if (!(await isAiGenerationEnabled())) {
        return NextResponse.json(AI_DISABLED_RESPONSE, { status: 503 });
      }

      const authUser = await getAuthUser();
      const userId = authUser?.id ?? null;

      // ~$0.002 per the module's own cost note above; also used as the
      // committed cost since Anthropic doesn't return per-call token cost here.
      const ESTIMATED_COST_MICRO_USD = 2_000;
      const betaGate = userId
        ? await beginBetaGatedAction(userId, "ai_deep_search", ESTIMATED_COST_MICRO_USD)
        : ({ mode: "not_beta" } as const);

      if (betaGate.mode === "beta_blocked") {
        return NextResponse.json(betaBlockedResponseBody(betaGate, langForI18n), { status: 429 });
      }

      let remaining: number | null = betaGate.mode === "beta_allowed" ? betaGate.remainingTotal : null;
      if (betaGate.mode === "not_beta") {
        // Not a beta member — existing commercial credit check, unchanged.
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
        remaining = usage.remaining;
      }

      // Generate smart query variants with Haiku
      const generation = await generateQueryVariants(niche, city, country, language);
      queries = generation.queries;

      // aiSucceeded reflects whether the actual Anthropic call worked —
      // generateQueryVariants never throws, it always falls back silently,
      // so this is the real signal for commit vs release, not a try/catch.
      if (generation.aiSucceeded) {
        await finishBetaGatedAction(betaGate, computeRealCostMicroUsd(generation.usage) ?? ESTIMATED_COST_MICRO_USD);
      } else {
        await abortBetaGatedAction(betaGate);
      }

      if (userId) await logEvent(userId, "deep_search_completed", {});

      return NextResponse.json(await executeAndRespond(queries, city, socialPresence, searchMode, remaining, userId));
    } else {
      // Standard — fixed set of query variants, no AI cost
      queries = [niche, `${niche} ${city}`, `${niche} i ${city}`, `bästa ${niche} ${city}`];

      const authUser = await getAuthUser();
      if (authUser) await logEvent(authUser.id, "search_completed", {});

      return NextResponse.json(
        await executeAndRespond(queries, city, socialPresence, searchMode, null, authUser?.id ?? null),
      );
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
  userId: string | null,
) {
  const runIds = await runQueries(queries, city, socialPresence);
  console.log(`[discover] ${queries.length} queries → ${runIds.length} runs`);

  // Record which user used these (shared) runs — provider_runs itself
  // stays a shared cache across all users; this is a separate, additive
  // ownership record used only by features that need "my saved leads"
  // (e.g. the outreach page's lead picker). See
  // docs/SEARCH_CACHING_ARCHITECTURE.md.
  await recordUserSearchRuns(userId, runIds);

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
