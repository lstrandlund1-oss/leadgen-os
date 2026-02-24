import type { RawCompany, Classification, PrimaryIndustry } from "@/lib/types";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Infer a primary industry from raw provider categories and name.
 * Rules-only for now. Later: swap internals for AI, keep output shape identical.
 */
function inferPrimaryIndustry(raw: RawCompany): PrimaryIndustry {
  const allText = [raw.name, ...(raw.categories ?? []), raw.description ?? ""]
    .join(" ")
    .toLowerCase();

  if (allText.includes("real estate") || allText.includes("mäklare")) {
    return "real_estate";
  }

  if (allText.includes("tattoo") || allText.includes("tatuering")) {
    return "tattoo_studio";
  }

  if (
    allText.includes("clinic") ||
    allText.includes("klinik") ||
    allText.includes("skönhet") ||
    allText.includes("beauty")
  ) {
    return "beauty_clinic";
  }

  if (
    allText.includes("restaurant") ||
    allText.includes("restaurang") ||
    allText.includes("bistro")
  ) {
    return "restaurant";
  }

  return "other";
}

function classifyRules(raw: RawCompany): Classification {
  const primaryIndustry = inferPrimaryIndustry(raw);

  const subNiche = raw.categories?.[0] ?? "";

  let serviceType: Classification["serviceType"] = "other";
  if (
    primaryIndustry === "real_estate" ||
    primaryIndustry === "tattoo_studio" ||
    primaryIndustry === "beauty_clinic" ||
    primaryIndustry === "restaurant"
  ) {
    serviceType = "local_service";
  }

  let b2b_b2c: Classification["b2b_b2c"] = "unknown";
  if (
    primaryIndustry === "tattoo_studio" ||
    primaryIndustry === "beauty_clinic" ||
    primaryIndustry === "restaurant"
  ) {
    b2b_b2c = "b2c";
  } else if (primaryIndustry === "real_estate") {
    b2b_b2c = "both";
  }

  const isGoodFit =
    primaryIndustry === "real_estate" ||
    primaryIndustry === "tattoo_studio" ||
    primaryIndustry === "beauty_clinic";

  let fitScoreReason: string;
  if (primaryIndustry === "real_estate") {
    fitScoreReason =
      "Real estate is a core niche: high-ticket, lead-driven, and heavily dependent on trust and content.";
  } else if (primaryIndustry === "tattoo_studio") {
    fitScoreReason =
      "Tattoo studios win with strong visuals and consistent content that builds desire and trust.";
  } else if (primaryIndustry === "beauty_clinic") {
    fitScoreReason =
      "Beauty clinics rely on visual proof, education and trust – perfect match for content-driven funnels.";
  } else if (primaryIndustry === "restaurant") {
    fitScoreReason =
      "Restaurants benefit from content, but they are not your primary target niche right now.";
  } else {
    fitScoreReason =
      "Category does not match your current core target niches. Still usable for tests and volume, but lower priority.";
  }

  let confidence = 60;
  if (primaryIndustry === "real_estate") confidence = 85;
  else if (primaryIndustry === "tattoo_studio") confidence = 80;
  else if (primaryIndustry === "beauty_clinic") confidence = 80;
  else if (primaryIndustry === "restaurant") confidence = 55;
  else confidence = 40;

  confidence = clamp(confidence, 0, 100);

  return {
    primaryIndustry,
    subNiche,
    serviceType,
    b2b_b2c,
    isGoodFit,
    fitScoreReason,
    confidence,
    source: "rules",
  };
}

/**
 * Single exported entrypoint.
 * Everything else is private so no other module can accidentally depend on internals.
 */
export function classifyCompany(raw: RawCompany): Classification {
  return classifyRules(raw);
}



