import { describe, it, expect } from "vitest";
import { computeExpiryState } from "./access";
import type { BetaMembership } from "./types";

function makeMembership(overrides: Partial<BetaMembership> = {}): BetaMembership {
  const activatedAt = new Date("2026-01-01T00:00:00Z");
  const hardEndAt = new Date(activatedAt);
  hardEndAt.setDate(hardEndAt.getDate() + 14);

  return {
    id: "membership-1",
    userId: "user-1",
    invitationId: "invite-1",
    status: "active",
    timezone: "Europe/Stockholm",
    activatedAt: activatedAt.toISOString(),
    hardEndAt: hardEndAt.toISOString(),
    activeDaysUsed: 0,
    lastActiveDate: null,
    extendedDays: 0,
    extensionGrantedBy: null,
    extensionGrantedAt: null,
    expiredAt: null,
    revokedAt: null,
    convertedAt: null,
    monetaryCeilingMicroUsd: null,
    finalInterviewCompleted: false,
    finalInterviewCompletedAt: null,
    requiredFeedbackCompleted: false,
    requiredFeedbackCompletedAt: null,
    internalNotes: null,
    createdAt: activatedAt.toISOString(),
    updatedAt: activatedAt.toISOString(),
    ...overrides,
  };
}

describe("computeExpiryState — seven active days limit", () => {
  it("does not expire below 7 active days", () => {
    const membership = makeMembership({ activeDaysUsed: 6 });
    const now = new Date("2026-01-05T00:00:00Z"); // well within the 14-day calendar window
    const state = computeExpiryState(membership, now);
    expect(state.daysUsedExceeded).toBe(false);
    expect(state.daysRemainingActive).toBe(1);
  });

  it("expires at exactly 7 active days", () => {
    const membership = makeMembership({ activeDaysUsed: 7 });
    const now = new Date("2026-01-05T00:00:00Z");
    const state = computeExpiryState(membership, now);
    expect(state.daysUsedExceeded).toBe(true);
    expect(state.daysRemainingActive).toBe(0);
  });

  it("stays expired past 7 active days", () => {
    const membership = makeMembership({ activeDaysUsed: 9 });
    const now = new Date("2026-01-05T00:00:00Z");
    const state = computeExpiryState(membership, now);
    expect(state.daysUsedExceeded).toBe(true);
    expect(state.daysRemainingActive).toBe(0); // clamped, never negative
  });
});

describe("computeExpiryState — fourteen calendar days limit", () => {
  it("expires on the 14-calendar-day boundary even with very few active days used", () => {
    const membership = makeMembership({ activeDaysUsed: 1 }); // far from the 7-active-day limit
    const now = new Date("2026-01-15T00:01:00Z"); // just past activatedAt + 14 days
    const state = computeExpiryState(membership, now);
    expect(state.calendarExceeded).toBe(true);
  });

  it("does not expire before the 14-calendar-day boundary", () => {
    const membership = makeMembership({ activeDaysUsed: 1 });
    const now = new Date("2026-01-10T00:00:00Z"); // still within 14 days
    const state = computeExpiryState(membership, now);
    expect(state.calendarExceeded).toBe(false);
  });
});

describe("computeExpiryState — extension", () => {
  it("pushes the calendar boundary out without touching active-day accounting", () => {
    const membership = makeMembership({ activeDaysUsed: 2, extendedDays: 7 });
    // 15 days after activation — past the original 14-day window, but
    // within the extended 21-day window (14 + 7).
    const now = new Date("2026-01-16T00:00:00Z");
    const state = computeExpiryState(membership, now);
    expect(state.calendarExceeded).toBe(false);
    // Extension must never touch activeDaysUsed/daysRemainingActive — it
    // only ever adds calendar days, per the spec's explicit requirement
    // that extension "must not reset existing usage counters."
    expect(state.daysRemainingActive).toBe(5); // unaffected by the extension
  });

  it("still expires once the extended calendar window itself passes", () => {
    const membership = makeMembership({ activeDaysUsed: 2, extendedDays: 7 });
    const now = new Date("2026-01-25T00:00:00Z"); // past 14 + 7 = 21 days
    const state = computeExpiryState(membership, now);
    expect(state.calendarExceeded).toBe(true);
  });
});
