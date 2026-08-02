import { describe, it, expect } from "vitest";
import { computePriorityScore, type PriorityInput } from "./priorityScore";

const base: PriorityInput = {
  opportunityValue: 70,
  isContacted: false,
  isReplied: false,
  isClosed: false,
  followupOverdue: false,
  daysSinceScored: 0,
};

describe("computePriorityScore", () => {
  it("closed opportunities are never recommended, regardless of score", () => {
    const score = computePriorityScore({ ...base, opportunityValue: 100, isClosed: true });
    expect(score).toBe(-Infinity);
  });

  it("a fresh, uncontacted opportunity scores higher than an equally-scored, already-contacted one", () => {
    const fresh = computePriorityScore({ ...base, isContacted: false });
    const contacted = computePriorityScore({ ...base, isContacted: true });
    expect(fresh).toBeGreaterThan(contacted);
  });

  it("an overdue follow-up ranks above an equally-scored opportunity with no follow-up due", () => {
    const overdue = computePriorityScore({ ...base, isContacted: true, followupOverdue: true });
    const noFollowup = computePriorityScore({ ...base, isContacted: true, followupOverdue: false });
    expect(overdue).toBeGreaterThan(noFollowup);
  });

  it("a higher raw opportunity value generally ranks higher, all else equal", () => {
    const high = computePriorityScore({ ...base, opportunityValue: 90 });
    const low = computePriorityScore({ ...base, opportunityValue: 40 });
    expect(high).toBeGreaterThan(low);
  });

  it("older scored-at dates rank lower than fresher ones, all else equal", () => {
    const fresh = computePriorityScore({ ...base, daysSinceScored: 0 });
    const stale = computePriorityScore({ ...base, daysSinceScored: 60 });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("recency penalty is capped and never fully erases a strong opportunity score", () => {
    const veryStale = computePriorityScore({ ...base, opportunityValue: 90, daysSinceScored: 10_000 });
    // Even after the max recency penalty (20) and no other bonuses, a 90
    // should still land comfortably positive, not collapse to near-zero.
    expect(veryStale).toBeGreaterThan(60);
  });

  it("replied leads are not treated as 'fresh uncontacted' even without an explicit contacted flag", () => {
    // A reply implies contact happened, even if isContacted wasn't
    // separately set — the fresh-uncontacted bonus should not apply.
    const withoutBonus = computePriorityScore({ ...base, isContacted: false, isReplied: true });
    const withBonus = computePriorityScore({ ...base, isContacted: false, isReplied: false });
    expect(withoutBonus).toBeLessThan(withBonus);
  });
});
