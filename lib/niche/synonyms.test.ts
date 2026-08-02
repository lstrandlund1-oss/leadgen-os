import { describe, it, expect } from "vitest";
import { getSearchQueries, normalizeNiche } from "./synonyms";

describe("getSearchQueries", () => {
  it("expands the rebuild spec's own example (tattoo studios) — previously returned zero expansion", () => {
    const queries = getSearchQueries("tatuerare");
    expect(queries).toContain("tatuerare");
    expect(queries).toContain("tattoo");
  });

  it("expands a Swedish synonym to include the canonical English term", () => {
    const queries = getSearchQueries("mäklare");
    expect(queries).toEqual(["mäklare", "real estate"]);
  });

  it("does not expand a term with no known synonym group", () => {
    const queries = getSearchQueries("some very specific unmapped niche");
    expect(queries).toEqual(["some very specific unmapped niche"]);
  });

  it("does not double up when the input is already the canonical term", () => {
    const queries = getSearchQueries("real estate");
    expect(queries).toEqual(["real estate"]);
  });

  it("never returns more than 2 queries — the deliberate cost cap", () => {
    for (const niche of ["tatuerare", "mäklare", "vvs", "rekrytering", "spa"]) {
      expect(getSearchQueries(niche).length).toBeLessThanOrEqual(2);
    }
  });
});

describe("normalizeNiche — newly added categories", () => {
  it.each([
    ["vvs", "plumbing"],
    ["elektriker", "electrical"],
    ["djurklinik", "veterinary"],
    ["webbyrå", "it services"],
    ["försäkringsmäklare", "financial services"],
    ["flyttfirma", "moving company"],
    ["bemanningsföretag", "recruitment"],
    ["tryckeri", "printing"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeNiche(input)).toBe(expected);
  });
});
