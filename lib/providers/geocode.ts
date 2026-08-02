// lib/providers/geocode.ts
//
// Resolves a free-text location (e.g. "Stockholm", "Göteborg, Sweden") to
// coordinates and a bounding viewport, using Google's Geocoding API — a
// separate product from the Places Text Search API already in use, but
// under the same Maps Platform key (GOOGLE_MAPS_API_KEY), provided
// Geocoding is enabled for that key in Google Cloud Console.
//
// This is the foundational piece for geographic partitioning (Week 1 of
// the core rebuild): partitioning a search area into smaller cells
// requires an actual center point and area size, which the current
// pure-text search has never needed. Deliberately built as an isolated
// module — the partitioning logic itself is a separate, later piece that
// consumes this, not bundled together, so each part can be tested and
// verified independently before being wired into the live search path.

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export type GeocodeResult = {
  lat: number;
  lng: number;
  // The bounding box Google considers this location to span — used to
  // decide how large an area needs to be partitioned. Falls back to a
  // single point (viewport with zero span) if Google doesn't return one,
  // which callers should treat as "couldn't determine an area size,
  // don't partition."
  viewport: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  formattedAddress: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function geocodeLocation(locationText: string): Promise<GeocodeResult | null> {
  const query = locationText.trim();
  if (!query) return null;

  let apiKey: string;
  try {
    apiKey = requireEnv("GOOGLE_MAPS_API_KEY");
  } catch {
    console.error("geocodeLocation: GOOGLE_MAPS_API_KEY not configured");
    return null;
  }

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(query)}&key=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error("geocodeLocation: network error", err);
    return null;
  }

  if (!res.ok) {
    console.error(`geocodeLocation: HTTP ${res.status} for "${query}"`);
    return null;
  }

  let data: GeocodeApiResponse;
  try {
    data = (await res.json()) as GeocodeApiResponse;
  } catch (err) {
    console.error("geocodeLocation: failed to parse response", err);
    return null;
  }

  if (data.status !== "OK" || !data.results?.length) {
    // ZERO_RESULTS is an expected, non-error outcome for a genuinely
    // unrecognizable location string — not logged as an error, just
    // returns null so the caller can fall back to the non-partitioned
    // search path.
    if (data.status !== "ZERO_RESULTS") {
      console.error(`geocodeLocation: API returned status "${data.status}" for "${query}"`);
    }
    return null;
  }

  const result = data.results[0];
  const location = result.geometry?.location;
  if (!location) return null;

  const viewport = result.geometry?.viewport ?? {
    northeast: location,
    southwest: location,
  };

  return {
    lat: location.lat,
    lng: location.lng,
    viewport,
    formattedAddress: result.formatted_address ?? query,
  };
}

type GeocodeApiResponse = {
  status: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location: { lat: number; lng: number };
      viewport?: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
      };
    };
  }>;
};
