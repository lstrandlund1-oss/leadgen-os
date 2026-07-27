// lib/killSwitch.ts
// Platform-wide AI generation kill switch. Checked at the start of every
// AI-calling endpoint. Toggled instantly from the admin dashboard — no
// redeploy needed, unlike an environment variable.
//
// Cached briefly (30s) so a busy endpoint doesn't add a DB round-trip to
// every single request — a 30-second worst-case delay in an emergency
// shutoff is an acceptable tradeoff for not hammering the database on
// every AI call.

import { getServiceClient } from "@/lib/supabaseServiceClient";

const CACHE_TTL_MS = 30_000;
let cached: { enabled: boolean; expiresAt: number } | null = null;

export async function isAiGenerationEnabled(): Promise<boolean> {
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;

  const client = await getServiceClient();
  if (!client) return true; // fail-open — an outage in this check shouldn't take down AI features

  const { data, error } = await client
    .from("platform_settings")
    .select("enabled")
    .eq("key", "ai_generation_enabled")
    .maybeSingle();

  const enabled = error || !data ? true : data.enabled;
  cached = { enabled, expiresAt: Date.now() + CACHE_TTL_MS };
  return enabled;
}

// Standard response body for every AI endpoint to return when disabled —
// keeps the message consistent across all of them.
export const AI_DISABLED_RESPONSE = {
  error: "AI features are temporarily paused. Please try again shortly.",
  code: "AI_GENERATION_DISABLED",
} as const;
