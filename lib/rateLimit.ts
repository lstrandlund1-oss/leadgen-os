// lib/rateLimit.ts
type RateLimitResult =
    | { ok: true; remaining: number; resetMs: number }
    | { ok: false; retryAfterSeconds: number; resetMs: number };

type Bucket = {
    hits: number[];
};

const buckets = new Map<string, Bucket>();

export function rateLimit(params: {
    key: string;          // unique key (e.g., provider + ip/user)
    limit: number;        // max requests per window
    windowMs: number;     // sliding window size
}): RateLimitResult {
    const now = Date.now();
    const { key, limit, windowMs } = params;

    let bucket = buckets.get(key);
    if (!bucket) {
        bucket = { hits: [] };
        buckets.set(key, bucket);
    }

    // prune old hits
    const cutoff = now - windowMs;
    bucket.hits = bucket.hits.filter((t) => t > cutoff);

    if (bucket.hits.length >= limit) {
        const oldest = bucket.hits[0];
        const resetMs = Math.max(oldest + windowMs - now, 0);
        const retryAfterSeconds = Math.max(Math.ceil(resetMs / 1000), 1);
        return { ok: false, retryAfterSeconds, resetMs };
    }

    bucket.hits.push(now);
    const remaining = Math.max(limit - bucket.hits.length, 0);

    // reset time is when the oldest hit exits window (or full window if first hit)
    const oldest = bucket.hits[0] ?? now;
    const resetMs = Math.max(oldest + windowMs - now, 0);

    return { ok: true, remaining, resetMs };
}

/**
 * Helpful for tests/dev. Not required.
 */
export function _clearRateLimits() {
    buckets.clear();
}
