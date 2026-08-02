// lib/ingest/normalizeDomain.ts
//
// Normalizes a website URL to a comparable domain, so the same real
// business found via different providers (which may format URLs
// differently — with/without https, with/without www, trailing slashes,
// query params) can be recognized as the same company even though their
// (source, source_id) pairs are completely different per-provider IDs.

export function normalizeDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;

  try {
    // Add a scheme if missing so URL parsing works consistently either way.
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    let host = url.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    return host || null;
  } catch {
    // Not a parseable URL at all — treat as no usable domain rather than
    // guessing at a malformed value.
    return null;
  }
}
