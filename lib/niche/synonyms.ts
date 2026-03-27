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
/**
 * City zone suffixes for grid-based coverage.
 * For a given city, returns sub-location strings that cover different
 * geographic zones so a single 20-result cap doesn't miss half the city.
 * Returns [] for unknown cities (falls back to plain city search).
 */
const CITY_ZONES: Record<string, string[]> = {
  stockholm:   ["stockholm city", "stockholm south", "stockholm west", "stockholm north", "stockholm east"],
  göteborg:    ["göteborg centrum", "göteborg hisingen", "göteborg majorna", "göteborg öster"],
  gothenburg:  ["gothenburg city centre", "gothenburg hisingen", "gothenburg south"],
  malmö:       ["malmö centrum", "malmö söder", "malmö hyllie"],
  malmo:       ["malmo city centre", "malmo south"],
  london:      ["london city", "london east", "london west", "london north", "london south"],
  manchester:  ["manchester city centre", "manchester north", "manchester south"],
  berlin:      ["berlin mitte", "berlin west", "berlin east", "berlin north"],
  paris:       ["paris 1er", "paris 8eme", "paris 15eme", "paris 20eme"],
  amsterdam:   ["amsterdam centrum", "amsterdam west", "amsterdam oost"],
  oslo:        ["oslo sentrum", "oslo east", "oslo west"],
  copenhagen:  ["copenhagen city", "copenhagen north", "copenhagen south"],
  helsinki:    ["helsinki city centre", "helsinki east", "helsinki west"],
};

/**
 * Returns location strings covering different zones of a city,
 * or [location] if the city is unknown.
 * Used to fan out parallel searches and union results when a single
 * query returns fewer than ~15 results (Google Places 20-result cap).
 */
export function getCityZones(location: string): string[] {
  const normalised = location.trim().toLowerCase();
  const zones = CITY_ZONES[normalised];
  if (zones) return zones;
  for (const [city, cityZones] of Object.entries(CITY_ZONES)) {
    if (normalised.includes(city)) return cityZones;
  }
  return [location.trim()];
}