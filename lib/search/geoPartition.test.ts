import { describe, it, expect } from "vitest";
import { planSearchCells, subdivideCell, type Viewport } from "./geoPartition";

// Stockholm's approximate viewport — a real, mid-large city, representative
// of the actual case this exists to fix ("niche + area search returns
// fewer than ~50 businesses even when substantially more likely exist").
const STOCKHOLM_VIEWPORT: Viewport = {
  northeast: { lat: 59.435, lng: 18.19 },
  southwest: { lat: 59.28, lng: 17.9 },
};

// A small town — should NOT be partitioned, a single query already covers it.
const SMALL_TOWN_VIEWPORT: Viewport = {
  northeast: { lat: 59.302, lng: 18.102 },
  southwest: { lat: 59.298, lng: 18.098 },
};

describe("planSearchCells", () => {
  it("returns null for an area too small to be worth partitioning", () => {
    expect(planSearchCells(SMALL_TOWN_VIEWPORT)).toBeNull();
  });

  it("returns multiple cells for a real city", () => {
    const cells = planSearchCells(STOCKHOLM_VIEWPORT);
    expect(cells).not.toBeNull();
    expect(cells!.length).toBeGreaterThan(1);
  });

  it("every returned cell falls within (or very near) the requested viewport", () => {
    const cells = planSearchCells(STOCKHOLM_VIEWPORT)!;
    const latPad = 0.02; // small tolerance for cells centered near the edge
    const lngPad = 0.02;
    for (const cell of cells) {
      expect(cell.lat).toBeGreaterThanOrEqual(STOCKHOLM_VIEWPORT.southwest.lat - latPad);
      expect(cell.lat).toBeLessThanOrEqual(STOCKHOLM_VIEWPORT.northeast.lat + latPad);
      expect(cell.lng).toBeGreaterThanOrEqual(STOCKHOLM_VIEWPORT.southwest.lng - lngPad);
      expect(cell.lng).toBeLessThanOrEqual(STOCKHOLM_VIEWPORT.northeast.lng + lngPad);
    }
  });

  it("never generates more than the safety cap, even for a very large area", () => {
    const hugeViewport: Viewport = {
      northeast: { lat: 69.0, lng: 24.0 },
      southwest: { lat: 55.0, lng: 11.0 },
    };
    const cells = planSearchCells(hugeViewport);
    expect(cells).not.toBeNull();
    expect(cells!.length).toBeLessThanOrEqual(30);
  });

  it("a larger requested cell radius produces fewer cells than a smaller one, for the same area", () => {
    const fewer = planSearchCells(STOCKHOLM_VIEWPORT, 6_000)!;
    const more = planSearchCells(STOCKHOLM_VIEWPORT, 1_500)!;
    expect(fewer.length).toBeLessThan(more.length);
  });
});

describe("subdivideCell", () => {
  it("splits one cell into exactly 4 sub-cells", () => {
    const original = { lat: 59.33, lng: 18.06, radiusMeters: 3000 };
    const subCells = subdivideCell(original);
    expect(subCells).toHaveLength(4);
  });

  it("each sub-cell has half the radius of the original", () => {
    const original = { lat: 59.33, lng: 18.06, radiusMeters: 3000 };
    const subCells = subdivideCell(original);
    for (const sub of subCells) {
      expect(sub.radiusMeters).toBe(1500);
    }
  });

  it("sub-cells are positioned around the original center, not all identical", () => {
    const original = { lat: 59.33, lng: 18.06, radiusMeters: 3000 };
    const subCells = subdivideCell(original);
    const uniqueLats = new Set(subCells.map((c) => c.lat));
    const uniqueLngs = new Set(subCells.map((c) => c.lng));
    // 2 distinct lat values, 2 distinct lng values (a 2x2 grid)
    expect(uniqueLats.size).toBe(2);
    expect(uniqueLngs.size).toBe(2);
  });

  it("sub-cells stay reasonably close to the original center (within the original radius)", () => {
    const original = { lat: 59.33, lng: 18.06, radiusMeters: 3000 };
    const subCells = subdivideCell(original);
    for (const sub of subCells) {
      const latDiffMeters = Math.abs(sub.lat - original.lat) * 111_320;
      expect(latDiffMeters).toBeLessThan(original.radiusMeters);
    }
  });
});
