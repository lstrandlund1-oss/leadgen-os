// lib/search/dedupeLeads.ts
//
// Deterministic deduplication across all query results.
// Priority: sourceId > website domain > name similarity.
// Returns a flat deduplicated array preserving order (first-seen wins).

type MinimalLead = {
  sourceId?: string;
  company: {
    name: string;
    website?: string | null;
  };
};

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    // Strip www. for normalisation
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9åäöüéàñ\s]/g, "") // keep letters + spaces
    .replace(/\s+/g, " ");
}

export function dedupeLeads<T extends MinimalLead>(leads: T[]): T[] {
  const seenIds = new Set<string>();
  const seenDomains = new Set<string>();
  const seenNames = new Set<string>();
  const result: T[] = [];

  for (const lead of leads) {
    // Check sourceId (most reliable)
    const id = lead.sourceId;
    if (id) {
      if (seenIds.has(id)) continue;
    }

    // Check website domain
    const domain = extractDomain(lead.company.website);
    if (domain) {
      if (seenDomains.has(domain)) continue;
    }

    // Check normalised name
    const name = normaliseName(lead.company.name);
    if (seenNames.has(name)) continue;

    // Not a duplicate — accept and record
    if (id) seenIds.add(id);
    if (domain) seenDomains.add(domain);
    seenNames.add(name);
    result.push(lead);
  }

  return result;
}
