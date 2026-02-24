import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import type { Lead, RawCompany } from "@/lib/types";
import { classifyCompany } from "@/lib/classification";
import { scoreLead } from "@/lib/scoring";
import {
  persistRawCompany,
  persistNormalizedCompany,
  persistClassification,
} from "@/lib/persistence";

type Presence = "low" | "medium" | "high";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
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
    socialPresence === "low" || socialPresence === "medium" || socialPresence === "high"
      ? socialPresence
      : null;

  // Small helpers for mock realism
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
    // rating is not strictly coupled to presence (real world), but we keep ranges stable.
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
    console.log("Persisting raw company:", raw.name);
    const rawId = await persistRawCompany(raw);
    if (!rawId) {
      console.error("persistRawCompany returned null rawId", raw);
      continue;
    }

    await persistNormalizedCompany(rawId, raw);

    // Classify
    const classification = classifyCompany(raw);
    await persistClassification(rawId, classification);

    // Score WITH presence available to scoring.ts
    const rawWithPresence = { ...raw, socialPresence: chosenPresence };
    const { score, priority } = scoreLead(rawWithPresence, classification);

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

      classification: {
        primaryIndustry: classification.primaryIndustry,
        confidence: classification.confidence,
      },

      score: {
        value: score,
        priority,
      },

      metadata: {
        runId: "legacy",
      },
    };

    leads.push(lead);
  }

  // -------------------------------------------
  // 3) Save the search in Supabase
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
  } else {
    console.warn("Supabase client not initialized. Skipping search insert.");
  }

  return NextResponse.json({ leads });
}
