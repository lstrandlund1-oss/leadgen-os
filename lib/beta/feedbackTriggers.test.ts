import { describe, it, expect } from "vitest";
import { reasonKeysForRating } from "./feedbackTriggers";

describe("reasonKeysForRating", () => {
  it("returns the low-rating reason set for 1 and 2 stars", () => {
    const oneStar = reasonKeysForRating(1);
    const twoStar = reasonKeysForRating(2);
    expect(oneStar).toEqual(twoStar);
    expect(oneStar).toContain("confusing");
    expect(oneStar).toContain("did_not_solve_need");
    expect(oneStar).not.toContain("easy_to_use");
  });

  it("returns the mid-rating reason set for 3 stars", () => {
    const midStar = reasonKeysForRating(3);
    expect(midStar).toContain("partly_useful");
    expect(midStar).toContain("unsure_i_trust_it");
    expect(midStar).not.toContain("confusing");
    expect(midStar).not.toContain("easy_to_use");
  });

  it("returns the high-rating reason set for 4 and 5 stars", () => {
    const fourStar = reasonKeysForRating(4);
    const fiveStar = reasonKeysForRating(5);
    expect(fourStar).toEqual(fiveStar);
    expect(fourStar).toContain("easy_to_use");
    expect(fourStar).toContain("saved_time");
    expect(fourStar).not.toContain("confusing");
  });

  it("never returns an empty set for any valid rating", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(reasonKeysForRating(rating).length).toBeGreaterThan(0);
    }
  });
});
