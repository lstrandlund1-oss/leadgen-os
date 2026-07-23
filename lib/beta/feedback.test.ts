import { describe, it, expect } from "vitest";
import { resolveFeedbackRating } from "./feedback";

describe("resolveFeedbackRating", () => {
  it("stores the rating when not_used_enough is false", () => {
    expect(resolveFeedbackRating(false, 4)).toBe(4);
    expect(resolveFeedbackRating(false, 1)).toBe(1);
  });

  it("never stores a numeric rating when not_used_enough is true, even if one was supplied", () => {
    expect(resolveFeedbackRating(true, 5)).toBeNull();
    expect(resolveFeedbackRating(true, 1)).toBeNull();
  });

  it("returns null when no rating was supplied at all", () => {
    expect(resolveFeedbackRating(false, null)).toBeNull();
    expect(resolveFeedbackRating(false, undefined)).toBeNull();
  });
});
