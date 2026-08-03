// lib/userSearchRuns.ts
//
// Records the association between a user and the (shared) provider_runs
// rows their search used, without touching provider_runs itself at all —
// that table stays a shared cache keyed by (provider, intent_hash),
// deliberately preserved for cross-user cost savings at scale.
//
// Uses the service-role client because the search pipeline's usual client
// (lib/supabaseClient.ts) is the anon-key singleton with no forwarded
// session, so auth.uid() isn't available there — same reasoning as the
// user_profiles RLS fix. See docs/SEARCH_CACHING_ARCHITECTURE.md.

import { getServiceClient } from "@/lib/supabaseServiceClient";

export async function recordUserSearchRuns(
  userId: string | null,
  runIds: number[],
  marketId?: string | null,
): Promise<void> {
  if (!userId || runIds.length === 0) return;

  const client = await getServiceClient();
  if (!client) return;

  const rows = runIds.map((runId) => ({
    user_id: userId,
    run_id: runId,
    ...(marketId ? { market_id: marketId } : {}),
  }));

  const { error } = await client.from("user_search_runs").upsert(rows, { onConflict: "user_id,run_id" });

  if (error) {
    console.error("recordUserSearchRuns error:", error.message);
  }
}
