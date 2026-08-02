import { describe, it, expect } from "vitest";
import { normalizeDomain } from "./normalizeDomain";

describe("normalizeDomain", () => {
  it("returns null for empty/missing input", () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain(undefined)).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("   ")).toBeNull();
  });

  it("strips protocol", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("strips www", () => {
    expect(normalizeDomain("https://www.example.com")).toBe("example.com");
  });

  it("strips trailing slashes and paths", () => {
    expect(normalizeDomain("https://example.com/")).toBe("example.com");
    expect(normalizeDomain("https://example.com/some/page")).toBe("example.com");
  });

  it("strips query params", () => {
    expect(normalizeDomain("https://example.com?utm_source=google")).toBe("example.com");
  });

  it("handles a bare domain with no scheme at all", () => {
    expect(normalizeDomain("example.com")).toBe("example.com");
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("two differently-formatted URLs for the same real business normalize identically", () => {
    // Exactly the scenario this exists for: Google Places and SerpApi
    // returning the same business with differently formatted website URLs.
    const fromGoogle = normalizeDomain("https://www.acmeplumbing.se/");
    const fromSerp = normalizeDomain("acmeplumbing.se");
    expect(fromGoogle).toBe(fromSerp);
  });

  it("lowercases the domain", () => {
    expect(normalizeDomain("https://WWW.Example.COM")).toBe("example.com");
  });

  it("returns null for genuinely unparseable input rather than guessing", () => {
    expect(normalizeDomain("not a url at all !!!")).toBeNull();
  });
});
