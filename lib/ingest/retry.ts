// lib/ingest/retry.ts

// DB-stored error codes come back as string|null, not strict enums.
// Keep this function tolerant and deterministic.
export function isRunRetryable(
  code: string | null | undefined,
  retryable?: boolean | null
): boolean {
  if (retryable === true) return true;

  switch (code) {
    case "TIMEOUT":
    case "UPSTREAM":
    case "RATE_LIMITED":
      return true;
    default:
      return false;
  }
}


