// lib/niche/synonyms.ts
// Cross-language and synonym mapping for niche search.

type SynonymGroup = { canonical: string; terms: string[] };

const SYNONYM_GROUPS: SynonymGroup[] = [
  { canonical: "real estate", terms: ["real estate","mäklare","fastighetsmäklare","fastighet","realtor","estate agent","property","fastigheter","bostäder","bostad"] },
  { canonical: "restaurant", terms: ["restaurant","restaurang","restauranger","café","cafe","kafé","bistro","eatery","matställe"] },
  { canonical: "dental", terms: ["dental","dentist","tandläkare","tandvård","tandläkarmottagning","dentistry"] },
  { canonical: "gym", terms: ["gym","fitness","träning","träningscenter","crossfit","yoga","pilates","pt","personal trainer","personlig tränare"] },
  { canonical: "salon", terms: ["salon","salong","frisör","hårfrisör","barber","barbershop","beauty","skönhetssalong","naglar","nail"] },
  { canonical: "law", terms: ["law","lawyer","advokat","advokatbyrå","juridik","jurist","attorney","legal"] },
  { canonical: "accounting", terms: ["accounting","accountant","revisor","redovisning","bokföring","ekonomi","bookkeeping","cpa"] },
  { canonical: "construction", terms: ["construction","byggfirma","bygg","byggare","snickare","hantverkare","contractor","builder","renovering","renovation"] },
  { canonical: "medical", terms: ["medical","clinic","klinik","läkare","doktor","hälsocenter","healthcare","vård"] },
  { canonical: "hotel", terms: ["hotel","hotell","hostel","vandrarhem","bed and breakfast","bnb","boende","logi"] },
  { canonical: "auto", terms: ["auto","car","bil","bilverkstad","verkstad","mechanic","garage","däck","tire"] },
  { canonical: "marketing", terms: ["marketing","marknadsföring","reklam","byrå","agency","digital marketing"] },
  { canonical: "cleaning", terms: ["cleaning","städ","städfirma","städbolag","cleaners","rengöring"] },
  { canonical: "photography", terms: ["photography","fotograf","fotografi","photographer","foto"] },
  { canonical: "childcare", terms: ["childcare","förskola","dagis","daycare","kindergarten","barnpassning"] },
];

const SYNONYM_MAP: Map<string, string> = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const term of group.terms) {
    SYNONYM_MAP.set(term.toLowerCase(), group.canonical);
  }
}

export function normalizeNiche(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  return SYNONYM_MAP.get(cleaned) ?? cleaned;
}

export function getNicheSynonyms(raw: string): string[] {
  const canonical = normalizeNiche(raw);
  const group = SYNONYM_GROUPS.find(g => g.canonical === canonical);
  if (!group) return [raw.trim().toLowerCase()];
  return group.terms;
}

/**
 * Returns the search queries to fire for a given niche input.
 * For cross-language pairs, returns [original, canonical] so both 
 * "mäklare" AND "real estate" are searched and results are merged.
 * Returns at most 2 queries to avoid excessive API usage.
 */
export function getSearchQueries(raw: string): string[] {
  const cleaned = raw.trim().toLowerCase();
  const canonical = SYNONYM_MAP.get(cleaned);
  
  // If no synonym found, just search the original term
  if (!canonical) return [cleaned];
  
  // If the input IS the canonical, just search it (no expansion needed)
  if (canonical === cleaned) return [cleaned];
  
  // Input is a synonym — return both the original and canonical
  // This covers: "mäklare" → ["mäklare", "real estate"]
  // and: "real estate" → ["real estate"] (already canonical)
  return [cleaned, canonical];
}