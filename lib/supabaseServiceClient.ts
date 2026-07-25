// lib/supabaseServiceClient.ts
// Service-role Supabase client for server-side operations that need to
// bypass RLS legitimately (e.g. an aggregate count on a table where client
// reads are otherwise blocked). Never import this into client components —
// it must only run server-side (API routes, server components).
//
// This mirrors lib/beta/serviceClient.ts's pattern but isn't beta-specific.

import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export async function getServiceClient(): Promise<SupabaseClient | null> {
  if (cached) return cached;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  if (!serviceKey || !supabaseUrl) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set — this operation cannot proceed");
    return null;
  }

  const { createClient } = await import("@supabase/supabase-js");
  cached = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
