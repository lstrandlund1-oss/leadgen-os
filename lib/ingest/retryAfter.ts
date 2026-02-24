// lib/ingest/retryAfter.ts
export function computeRetryAfterSeconds(
  code: string | null | undefined,
  providerSuggested?: number | null
): number {
  if (typeof providerSuggested === "number" && Number.isFinite(providerSuggested) && providerSuggested > 0) {
    return Math.min(Math.max(providerSuggested, 5), 3600);
  }

  switch (code) {
    case "RATE_LIMITED":
      return 60;
    case "TIMEOUT":
      return 20;
    case "UPSTREAM":
      return 30;
    default:
      return 0;
  }
}
