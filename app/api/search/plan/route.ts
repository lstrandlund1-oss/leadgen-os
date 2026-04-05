// app/api/search/plan/route.ts
//
// Generates an AI search plan for a niche + city.
// Called by the dashboard before executing a search.
// Scout: returns plan immediately (fast path, limited variants)
// Operator/Agency: full plan with districts + municipalities

import { NextResponse } from "next/server";
import { generateSearchPlan } from "@/lib/search/anthropicPlanner";
import type { SearchMode } from "@/lib/search/anthropicPlanner";
import { getEffectivePlan } from "@/lib/plan";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      niche?: string;
      city?: string;
      country?: string;
      language?: string;
      priorResultCount?: number;
    };

    const niche = typeof body.niche === "string" ? body.niche.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    if (!niche || !city) {
      return NextResponse.json({ error: "niche and city are required" }, { status: 400 });
    }

    const plan_tier = getEffectivePlan();
    const searchMode: SearchMode = plan_tier === "scout" ? "standard" : "deep";

    const plan = await generateSearchPlan({
      niche,
      city,
      country: typeof body.country === "string" ? body.country : "Sweden",
      language: typeof body.language === "string" ? body.language : undefined,
      priorResultCount: typeof body.priorResultCount === "number" ? body.priorResultCount : undefined,
      searchMode,
    });

    if (!plan) {
      // Fallback — return minimal plan so search can still proceed
      return NextResponse.json({
        ok: false,
        plan: {
          canonicalNiche: niche,
          queryVariants: [niche],
          languageVariants: [],
          districtVariants: [],
          municipalityVariants: [],
          expectedMarketSize: { min: 20, target: 50 },
        },
        fallback: true,
      });
    }

    return NextResponse.json({ ok: true, plan, searchMode });
  } catch (err) {
    console.error("[/api/search/plan]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
