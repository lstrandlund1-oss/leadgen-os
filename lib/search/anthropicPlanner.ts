// lib/search/anthropicPlanner.ts
//
// AI-powered search plan generator.
// Takes a niche + location and returns a structured set of queries
// that maximise recall across languages, synonyms, and local terminology.
// Uses Claude Haiku for speed and low cost.
// Returns strict JSON only — no prose, no explanations.

export type SearchMode = "standard" | "deep";

export interface SearchPlanInput {
  niche: string;
  city: string;
  country: string;
  language?: string; // "sv" | "en" | etc — detected or passed from UI
  priorResultCount?: number; // how many results we already have (for expansion)
  searchMode: SearchMode;
}

export interface SearchPlan {
  canonicalNiche: string;
  queryVariants: string[]; // e.g. ["tattoo studio", "tatuering", "tatueringsstudio"]
  languageVariants: string[]; // e.g. ["tattoo shop", "ink studio"]
  districtVariants: string[]; // e.g. ["tattoo studio södermalm", "tattoo studio vasastan"]
  municipalityVariants: string[]; // e.g. ["tattoo studio solna", "tattoo studio nacka"]
  expectedMarketSize: { min: number; target: number };
}

const SYSTEM_PROMPT = `You are a search planning engine for a B2B lead discovery platform.
Your job is to generate search query variants that maximise recall of local businesses in a given niche and city.
You must think about: local language terms, industry synonyms, alternative business names, and relevant city districts.
You MUST return strict JSON only. No explanations, no markdown, no code blocks. Raw JSON object only.`;

function buildUserPrompt(input: SearchPlanInput): string {
  const modeNote =
    input.searchMode === "deep"
      ? "Generate maximum coverage: all synonyms, all districts, all language variants."
      : "Generate 3-5 high-quality variants only. Prioritise recall over breadth.";

  return `Generate a search plan for finding local businesses.

Niche: "${input.niche}"
City: "${input.city}"
Country: "${input.country}"
Language hint: "${input.language ?? "unknown"}"
${input.priorResultCount !== undefined ? `Prior result count: ${input.priorResultCount} (expand if this is low)` : ""}

${modeNote}

Return ONLY this JSON structure (no other text):
{
  "canonicalNiche": "normalised English name for this niche",
  "queryVariants": ["array of 3-6 search query strings in local language + English"],
  "languageVariants": ["alternative terms in other languages or industry jargon"],
  "districtVariants": ["niche district Stockholm", "niche district Södermalm", ...up to 5 key districts for this city],
  "municipalityVariants": ["niche Solna", "niche Nacka", ...up to 3 nearby municipalities"],
  "expectedMarketSize": { "min": <conservative int>, "target": <realistic int> }
}

Rules:
- queryVariants must include the original term and its most common local synonyms
- districtVariants only for cities large enough to have distinct districts (Stockholm, London, Berlin etc)
- municipalityVariants only when city has significant surrounding municipalities
- expectedMarketSize should reflect real market density for this niche in this city
- All query strings should be ready to paste directly into Google search`;
}

export async function generateSearchPlan(input: SearchPlanInput): Promise<SearchPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[anthropicPlanner] Missing ANTHROPIC_API_KEY");
    return null;
  }

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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
      }),
    });

    if (!res.ok) {
      console.error("[anthropicPlanner] API error:", res.status);
      return null;
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text?.trim();
    if (!text) return null;

    // Strip any accidental markdown fences
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(clean) as Partial<SearchPlan>;

    return {
      canonicalNiche: typeof parsed.canonicalNiche === "string" ? parsed.canonicalNiche : input.niche,
      queryVariants: Array.isArray(parsed.queryVariants) ? parsed.queryVariants : [input.niche],
      languageVariants: Array.isArray(parsed.languageVariants) ? parsed.languageVariants : [],
      districtVariants: Array.isArray(parsed.districtVariants) ? parsed.districtVariants : [],
      municipalityVariants: Array.isArray(parsed.municipalityVariants) ? parsed.municipalityVariants : [],
      expectedMarketSize: parsed.expectedMarketSize ?? { min: 20, target: 50 },
    };
  } catch (err) {
    console.error("[anthropicPlanner] Failed to generate plan:", err);
    return null;
  }
}
