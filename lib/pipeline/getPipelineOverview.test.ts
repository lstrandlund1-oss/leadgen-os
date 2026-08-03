import { describe, it, expect } from "vitest";
import { classifyStage } from "./getPipelineOverview";

describe("classifyStage", () => {
  it("no outcome at all -> recommended", () => {
    expect(classifyStage(undefined)).toBe("recommended");
  });

  it("outcome exists but nothing set -> recommended", () => {
    expect(classifyStage({})).toBe("recommended");
  });

  it("contacted only -> contacted", () => {
    expect(classifyStage({ contacted: true })).toBe("contacted");
  });

  it("replied implies contacted happened -> replied", () => {
    expect(classifyStage({ contacted: true, replied: true })).toBe("replied");
  });

  it("booked_call -> meeting", () => {
    expect(classifyStage({ contacted: true, replied: true, booked_call: true })).toBe("meeting");
  });

  it("closed with no lost_reason -> won", () => {
    expect(classifyStage({ contacted: true, replied: true, booked_call: true, closed: true })).toBe("won");
  });

  it("closed with a lost_reason -> lost", () => {
    expect(
      classifyStage({ contacted: true, replied: true, booked_call: true, closed: true, lost_reason: "no budget" }),
    ).toBe("lost");
  });

  it("closed takes priority over all other flags, even if inconsistent", () => {
    // Defensive: even a row with contradictory data (closed=true but no
    // other progress flags) should classify as won/lost, not silently
    // fall through to an earlier stage.
    expect(classifyStage({ closed: true })).toBe("won");
    expect(classifyStage({ closed: true, lost_reason: "timing" })).toBe("lost");
  });
});
