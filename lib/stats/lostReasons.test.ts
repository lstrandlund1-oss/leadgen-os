import { describe, it, expect } from "vitest";
import { computeLostReasonBreakdown } from "./lostReasons";

describe("computeLostReasonBreakdown", () => {
  it("returns empty array with no lost deals", () => {
    expect(computeLostReasonBreakdown([])).toEqual([]);
  });

  it("ignores null (non-lost) entries", () => {
    const result = computeLostReasonBreakdown([null, null, "no_response"]);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("no_response");
    expect(result[0].count).toBe(1);
  });

  it("ignores unrecognized reason strings rather than crashing", () => {
    const result = computeLostReasonBreakdown(["no_response", "some_future_reason_not_in_the_list"]);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("no_response");
  });

  it("computes correct percentages relative to total lost, not total leads", () => {
    const result = computeLostReasonBreakdown(["no_response", "no_response", "not_interested"]);
    const noResponse = result.find((r) => r.reason === "no_response")!;
    expect(noResponse.count).toBe(2);
    expect(noResponse.percentOfLost).toBe(67);
  });

  it("sorts by count descending, most common reason first", () => {
    const result = computeLostReasonBreakdown([
      "price_too_high",
      "no_response",
      "no_response",
      "no_response",
      "not_interested",
      "not_interested",
    ]);
    expect(result[0].reason).toBe("no_response");
    expect(result[1].reason).toBe("not_interested");
    expect(result[2].reason).toBe("price_too_high");
  });
});
