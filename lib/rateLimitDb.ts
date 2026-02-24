// lib/rateLimitDb.ts
import { supabase } from "@/lib/supabaseClient";

export type DbRateLimitResult =
    | { ok: true; remaining: number; resetMs: number }
    | { ok: false; retryAfterSeconds: number; resetMs: number };

export async function rateLimitDb(params: {
    key: string;
    limit: number;
    windowMs: number;
}): Promise<DbRateLimitResult> {
    if (!supabase) {
        // Fail-open in dev if supabase is unavailable. If you prefer fail-closed, tell me.
        return { ok: true, remaining: params.limit, resetMs: params.windowMs };
    }

    const { data, error } = await supabase.rpc("rate_limit_consume", {
        p_key: params.key,
        p_window_ms: params.windowMs,
        p_limit: params.limit,
    });

    if (error || !data || !Array.isArray(data) || data.length === 0) {
        console.error("rate_limit_consume rpc error:", error?.message ?? "no data");
        // Fail-open (same rationale). Switch to fail-closed later if you want.
        return { ok: true, remaining: params.limit, resetMs: params.windowMs };
    }

    const row = data[0] as {
        allowed: boolean;
        remaining: number;
        reset_ms: number;
    };

    const resetMs = Number(row.reset_ms) || params.windowMs;

    if (!row.allowed) {
        const retryAfterSeconds = Math.max(Math.ceil(resetMs / 1000), 1);
        return { ok: false, retryAfterSeconds, resetMs };
    }

    return { ok: true, remaining: Number(row.remaining) || 0, resetMs };
}
