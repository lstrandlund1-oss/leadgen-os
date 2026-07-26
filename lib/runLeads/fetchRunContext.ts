// lib/runLeads/fetchRunContext.ts
//
// Fetches all context needed to hydrate and score leads for a given run.
// Centralises the DB calls that were previously scattered in the leads route.
//
// NOTE: currently dead code — nothing in the app calls fetchRunContext.
// Fixed the client anyway while auditing RLS (it was using the anon
// singleton with no session, so its user_profiles query would have always
// returned nothing since the RLS audit removed that table's open policy —
// see docs/SEARCH_CACHING_ARCHITECTURE.md for the related pattern). Uses
// the service-role client since userId here is an already-validated
// parameter passed in by the caller, not something needing a live session.

import { getServiceClient } from "@/lib/supabaseServiceClient";
import type { UserProfileV1, CapabilityProfile } from "@/lib/types";
import { buildUserProfile, buildCapabilityProfile, type ProfileTypeKey } from "@/lib/profile/profileTypes";

export interface RunContext {
  runId: number;
  provider: string;
  socialPresenceFilter: "any" | "low" | "medium" | "high";
  userProfile: UserProfileV1;
  capabilities: CapabilityProfile;
}

export type FetchRunContextResult = { ok: true; context: RunContext } | { ok: false; error: string };

export async function fetchRunContext(
  runId: number,
  userId: string,
): Promise<{ ok: true; context: RunContext } | { ok: false; error: string }> {
  const supabase = await getServiceClient();
  if (!supabase) {
    return { ok: false, error: "Supabase not configured" };
  }

  // 1. Fetch run intent (provider + filters)
  const { data: run, error: runError } = await supabase
    .from("provider_runs")
    .select("id, provider, intent")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    return { ok: false, error: `Run ${runId} not found: ${runError?.message ?? "unknown"}` };
  }

  const intent = (run.intent ?? {}) as Record<string, unknown>;
  const socialPresenceFilter = (
    intent.socialPresence === "low" || intent.socialPresence === "medium" || intent.socialPresence === "high"
      ? intent.socialPresence
      : "any"
  ) as "any" | "low" | "medium" | "high";

  // 2. Fetch user profile from DB
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("profile_type, profile_data, capability_data")
    .eq("id", userId)
    .single();

  const profileType = (profileRow?.profile_type ?? "performance_marketer") as ProfileTypeKey;
  const profileOverrides = (profileRow?.profile_data ?? {}) as Record<string, unknown>;
  const capOverrides = (profileRow?.capability_data ?? null) as Record<string, boolean> | null;

  const userProfile = buildUserProfile(userId, profileType, profileOverrides as never);
  const capabilities = buildCapabilityProfile(userId, profileType, capOverrides ?? undefined);

  return {
    ok: true,
    context: {
      runId,
      provider: run.provider as string,
      socialPresenceFilter,
      userProfile,
      capabilities: capabilities as import("@/lib/types").CapabilityProfile,
    },
  };
}
