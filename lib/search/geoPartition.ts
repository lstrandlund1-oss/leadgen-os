// lib/search/geoPartition.ts
//
// Splits a geographic area into a grid of overlapping circular search
// cells, so a broad search (e.g. "tattoo studio Stockholm") can be issued
// as multiple smaller, geographically-bounded queries instead of one
// query that Google's own per-request result cap silently truncates.
//
// Deliberately simple grid math (not geohash/H3) for a first version —
// straightforward to reason about, straightforward to test, and the
// adaptive-subdivision entry point (subdivideCell) means cells only get
// more sophisticated where actually needed, rather than over-engineering
// uniform fine-grained partitioning everywhere up front.

const METERS_PER_DEGREE_LAT = 111_320;

export type SearchCell = {
  lat: number;
  lng: number;
  radiusMeters: number;
};

export type Viewport = {
  northeast: { lat: number; lng: number };
  southwest: { lat: number; lng: number };
};

// Areas smaller than this aren't worth partitioning at all — a single
// query already covers them adequately, and partitioning a small town
// into cells would just waste API calls for near-zero benefit.
const MIN_AREA_TO_PARTITION_METERS = 8_000; // ~8km across

// Default cell radius for the initial grid. Deliberately mid-sized: small
// enough that a dense urban cell has a real chance of staying under
// Google's per-query result ceiling, large enough that a first pass over
// a whole city doesn't require dozens of cells (and dozens of API calls)
// before any adaptive subdivision even happens.
const DEFAULT_CELL_RADIUS_METERS = 3_000;

// Cells are spaced at 1.5x their radius (not 2x) so adjacent circles
// overlap slightly — without this, businesses sitting exactly between two
// cell centers could fall in the gap and never be found by either query.
const CELL_SPACING_FACTOR = 1.5;

function metersPerDegreeLng(atLat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((atLat * Math.PI) / 180);
}

// Returns null if the area is too small to be worth partitioning — callers
// should fall back to a single, unpartitioned search in that case.
export function planSearchCells(
  viewport: Viewport,
  cellRadiusMeters: number = DEFAULT_CELL_RADIUS_METERS,
): SearchCell[] | null {
  const centerLat = (viewport.northeast.lat + viewport.southwest.lat) / 2;
  const centerLng = (viewport.northeast.lng + viewport.southwest.lng) / 2;

  const heightMeters = Math.abs(viewport.northeast.lat - viewport.southwest.lat) * METERS_PER_DEGREE_LAT;
  const widthMeters = Math.abs(viewport.northeast.lng - viewport.southwest.lng) * metersPerDegreeLng(centerLat);

  if (heightMeters < MIN_AREA_TO_PARTITION_METERS && widthMeters < MIN_AREA_TO_PARTITION_METERS) {
    return null;
  }

  const spacingMeters = cellRadiusMeters * CELL_SPACING_FACTOR;
  const cols = Math.max(1, Math.ceil(widthMeters / spacingMeters));
  const rows = Math.max(1, Math.ceil(heightMeters / spacingMeters));

  // Cap total cells for a single search — this is a safety limit, not a
  // tuned value. Prevents a pathological input (e.g. an entire country
  // geocoded as one "location") from generating hundreds of cells and an
  // equivalent number of API calls in one search request.
  const MAX_CELLS = 30;
  if (cols * rows > MAX_CELLS) {
    // Fall back to a coarser grid that fits within the cap rather than
    // silently truncating coverage — this still partitions the search,
    // just with fewer, larger cells.
    const scale = Math.sqrt((cols * rows) / MAX_CELLS);
    return planSearchCells(viewport, cellRadiusMeters * scale);
  }

  const lngPerDegree = metersPerDegreeLng(centerLat);
  const cells: SearchCell[] = [];

  const startLat = viewport.southwest.lat + spacingMeters / METERS_PER_DEGREE_LAT / 2;
  const startLng = viewport.southwest.lng + spacingMeters / lngPerDegree / 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({
        lat: startLat + row * (spacingMeters / METERS_PER_DEGREE_LAT),
        lng: startLng + col * (spacingMeters / lngPerDegree),
        radiusMeters: cellRadiusMeters,
      });
    }
  }

  return cells;
}

// Splits one cell into 4 smaller cells (a 2x2 sub-grid) covering
// approximately the same area — used when a cell's search hits the
// provider's apparent result ceiling, indicating there are likely more
// businesses there than a single query surfaced. Each sub-cell gets half
// the radius; spaced with the same overlap factor as the top-level grid.
export function subdivideCell(cell: SearchCell): SearchCell[] {
  const subRadius = cell.radiusMeters / 2;
  const offsetMeters = subRadius * (CELL_SPACING_FACTOR / 2);
  const lngPerDegree = metersPerDegreeLng(cell.lat);

  const latOffset = offsetMeters / METERS_PER_DEGREE_LAT;
  const lngOffset = offsetMeters / lngPerDegree;

  return [
    { lat: cell.lat - latOffset, lng: cell.lng - lngOffset, radiusMeters: subRadius },
    { lat: cell.lat - latOffset, lng: cell.lng + lngOffset, radiusMeters: subRadius },
    { lat: cell.lat + latOffset, lng: cell.lng - lngOffset, radiusMeters: subRadius },
    { lat: cell.lat + latOffset, lng: cell.lng + lngOffset, radiusMeters: subRadius },
  ];
}
