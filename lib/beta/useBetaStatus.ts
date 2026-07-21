"use client";

import { useEffect, useState } from "react";

export type BetaStatus = {
  active: boolean;
  daysRemainingActive?: number;
  daysRemainingCalendar?: number;
  loading: boolean;
};

// Defaults to inactive/not-loading-blocked so UI doesn't flash a "loading"
// state for what's almost always a "no" answer (most users aren't beta
// testers) — the subscription UI just renders normally until/unless this
// resolves to active: true, at which point it swaps out.
export function useBetaStatus(): BetaStatus {
  const [status, setStatus] = useState<BetaStatus>({ active: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/beta/status")
      .then((res) => (res.ok ? res.json() : { active: false }))
      .then((data) => {
        if (!cancelled) setStatus({ ...data, loading: false });
      })
      .catch(() => {
        if (!cancelled) setStatus({ active: false, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
