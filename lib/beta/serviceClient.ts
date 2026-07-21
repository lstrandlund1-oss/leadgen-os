// lib/beta/serviceClient.ts
// Service-role Supabase client for beta system mutations. Follows the same
// pattern already used in app/api/account/delete/route.ts. Never import
// this into client components — it must only run server-side (API routes,
// server components, server actions).

import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export async function getBetaServiceClient(): Promise<SupabaseClient | null> {
  if (cached) return cached;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (!serviceKey || !supabaseUrl) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — beta system cannot read/write membership data");
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  cached = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
