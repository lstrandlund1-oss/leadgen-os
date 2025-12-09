import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type Lead = {
  id: number;
  companyName: string;
  niche: string;
  location: string;
  website?: string;
  socialPresence: "low" | "medium" | "high";
  score: number;
  priority: "Easy Win" | "Warm" | "Long Shot";
  companySizeLabel: string;
};

function calculateScore(
  socialPresence: "low" | "medium" | "high",
  companySizeLabel: string
) {
  let score = 50;

  // Low social presence = more upside for you
  if (socialPresence === "low") score += 30;
  if (socialPresence === "medium") score += 15;
  if (socialPresence === "high") score -= 10;

  // Make size impact more obvious
  const sizeLower = companySizeLabel.toLowerCase();
  if (sizeLower.includes("1–10") || sizeLower.includes("1-10") || sizeLower.includes("solo")) {
    score += 5;
  } else if (sizeLower.includes("10–50") || sizeLower.includes("10-50")) {
    score += 15;
  } else if (sizeLower.includes("50–200") || sizeLower.includes("50-200") || sizeLower.includes("200")) {
    score += 25;
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return score;
}

function getPriority(score: number): "Easy Win" | "Warm" | "Long Shot" {
  if (score >= 80) return "Easy Win";
  if (score >= 60) return "Warm";
  return "Long Shot";
}

export async function POST(request: Request) {
  const body = await request.json();
  const { niche, location, companySize, socialPresence } = body;

  const normalizedNiche = (niche?.trim() || "Local Business").toLowerCase();
  const normalizedLocation = location?.trim() || "Sweden";
  const companySizeLabel = companySize?.trim() || "Unknown size";

  const readableNiche =
    normalizedNiche.charAt(0).toUpperCase() + normalizedNiche.slice(1);

  // Base company names
  const baseCompanies = [
    "Prime Edge",
    "Visionary Labs",
    "Nordic Growth Partners",
    "Skyline Media",
    "Urban Pulse Studio",
    "Blue Horizon Clinic",
  ];

  const mockLeads: Lead[] = baseCompanies.map((name, index) => {
    const possiblePresence: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
    let chosenPresence: "low" | "medium" | "high";

    if (socialPresence === "low" || socialPresence === "medium" || socialPresence === "high") {
      chosenPresence = socialPresence;
    } else {
      chosenPresence = possiblePresence[index % possiblePresence.length];
    }

    const score = calculateScore(chosenPresence, companySizeLabel);
    const priority = getPriority(score);

    return {
      id: index + 1,
      companyName: `${readableNiche} – ${name} #${index + 1}`,
      niche: readableNiche,
      location: normalizedLocation,
      website: undefined,
      socialPresence: chosenPresence,
      score,
      priority,
      companySizeLabel,
    };
  });

  // Save the search in Supabase (best-effort, only if client is configured)
  if (supabase) {
    try {
      const { error } = await supabase.from("searches").insert({
        niche: normalizedNiche,
        location: normalizedLocation,
        company_size: companySizeLabel,
        social_presence: socialPresence || "any",
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

  return NextResponse.json({ leads: mockLeads });
}

