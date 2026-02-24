// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import type { Lead, RawCompany, RiskProfile } from "@/lib/types";
import { classifyCompany } from "@/lib/classification";
import { scoreLead } from "@/lib/scoring";
import {
  persistRawCompany,
  persistNormalizedCompany,
  persistClassification,
} from "@/lib/persistence";

type Presence = "low" | "medium" | "high";

function getNum(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  const v = rec[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function getRiskProfile(obj: unknown): RiskProfile {
  if (!obj || typeof obj !== "object") return "unstable_business";
  const rec = obj as Record<string, unknown>;
  const v = rec["riskProfile"];

  if (v === "unstable_business" || v === "mature_competitor") {
    return v;
  }

  return "unstable_business";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    niche?: unknown;
    location?: unknown;
    socialPresence?: unknown;
  };

  const niche = typeof body?.niche === "string" ? body.niche : "";
  const location = typeof body?.location === "string" ? body.location : "";
  const socialPresence = body?.socialPresence;

  const normalizedNiche = (niche.trim() || "Local Business").toLowerCase();
  const normalizedLocation = location.trim() || "Sweden";

  const readableNiche =
    normalizedNiche.charAt(0).toUpperCase() + normalizedNiche.slice(1);

  // -------------------------------------------
  // 1) Build raw mock companies (RawCompany layer)
  // -------------------------------------------
  const baseNames = [
    "Prime Edge",
    "Visionary Labs",
    "Nordic Growth Partners",
    "Skyline Media",
    "Urban Pulse Studio",
    "Blue Horizon Clinic",
  ];

  const possiblePresence: Presence[] = ["low", "medium", "high"];

  // Normalize requested presence (if provided)
  const requestedPresence: Presence | null =
    socialPresence === "low" ||
    socialPresence === "medium" ||
    socialPresence === "high"
      ? socialPresence
      : null;

  // Small helpers for mock realism
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const leads: Lead[] = [];

  for (let index = 0; index < baseNames.length; index++) {
    const name = baseNames[index];

    // Choose presence:
    // - If user selected a filter, apply it to all results.
    // - Otherwise distribute across low/medium/high to keep buckets visible.
    const chosenPresence: Presence =
      requestedPresence ?? possiblePresence[index % possiblePresence.length];

    // Mock metrics aligned to your product logic:
    // - low presence => opportunity (often no website, lower review count)
    // - high presence => harder (has website, more reviews)
    const hasWebsite =
      chosenPresence === "high"
        ? true
        : chosenPresence === "medium"
          ? index % 3 !== 0
          : false; // low => no website

    const reviewCount =
      chosenPresence === "high"
        ? clamp(120 + index * 55, 80, 450)
        : chosenPresence === "medium"
          ? clamp(25 + index * 20, 10, 200)
          : clamp(0 + index * 6, 0, 60);

    const rating =
      chosenPresence === "high"
        ? round1(clamp(4.1 + (index % 5) * 0.15, 3.6, 4.9))
        : chosenPresence === "medium"
          ? round1(clamp(4.0 + (index % 4) * 0.15, 3.6, 4.8))
          : round1(clamp(3.8 + (index % 4) * 0.2, 3.6, 4.7));

    const raw: RawCompany = {
      source: "mock",
      sourceId: `mock-${index + 1}`,
      name,
      categories: [readableNiche],
      website: hasWebsite ? `https://mock-${index + 1}.example.com` : undefined,
      address: undefined,
      city: normalizedLocation,
      country: normalizedLocation,
      description: `${readableNiche} business in ${normalizedLocation}`,
      rating,
      review_count: reviewCount,
      rawPayload: null,
    };

    // Persist raw + normalized
    const rawId = await persistRawCompany(raw);
    if (!rawId) continue;

    await persistNormalizedCompany(rawId, raw);

    // Classify (returns the FULL classification object)
    const classification = classifyCompany(raw);
    await persistClassification(rawId, classification);

    // Provide presence to scoring by attaching it to raw (if your scoring uses it)
    const rawWithPresence = { ...raw, socialPresence: chosenPresence };

    // Scoring API is now single-arg, and Lead.score expects ScoreResult (not {value, priority})
    const scoreResult = scoreLead(
      rawWithPresence as RawCompany,
      classification,
    );

    const lead: Lead = {
      id: String(rawId),
      source: raw.source,
      sourceId: raw.sourceId,

      company: {
        name: raw.name,
        website: raw.website ?? null,
        address: raw.address ?? null,
        city: raw.city ?? null,
        country: raw.country ?? null,
      },

      metrics: {
        rating: raw.rating ?? null,
        reviewCount: raw.review_count ?? null,
        socialPresence: chosenPresence,
      },

      // IMPORTANT: assign the full object, not a partial
      classification,

      // IMPORTANT: score is the full ScoreResult (no `priority` field)
      score: {
        value:
          getNum(scoreResult, "value") ?? getNum(scoreResult, "score") ?? 0,
        opportunity: getNum(scoreResult, "opportunity") ?? 0,
        readiness: getNum(scoreResult, "readiness") ?? 0,
        risk: getNum(scoreResult, "risk") ?? 0,
        riskProfile: getRiskProfile(scoreResult),
      },

      metadata: {
        runId: "legacy",
      },
    };

    leads.push(lead);
  }

  // -------------------------------------------
  // 2) Save the search in Supabase
  // -------------------------------------------
  if (supabase) {
    try {
      const { error } = await supabase.from("searches").insert({
        niche: normalizedNiche,
        location: normalizedLocation,
        social_presence: requestedPresence ?? "any",
      });

      if (error) {
        console.error("Supabase insert error:", error.message);
      }
    } catch (e) {
      console.error("Supabase insert exception:", e);
    }
  }

  return NextResponse.json({ leads });
}
