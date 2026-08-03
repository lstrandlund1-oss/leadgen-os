// lib/markets/markets.ts
//
// Core data layer for Markets — named, saved search definitions a user
// can revisit and refresh (Week 3 of the rebuild).

import { getServiceClient } from "@/lib/supabaseServiceClient";

export type Market = {
  id: string;
  name: string;
  niche: string;
  location: string;
  createdAt: string;
  lastRefreshedAt: string | null;
};

export async function createMarket(
  userId: string,
  name: string,
  niche: string,
  location: string,
): Promise<Market | null> {
  const client = await getServiceClient();
  if (!client) return null;

  const { data, error } = await client
    .from("markets")
    .insert({ user_id: userId, name, niche, location })
    .select("id, name, niche, location, created_at, last_refreshed_at")
    .single();

  if (error || !data) {
    console.error("createMarket error:", error?.message);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    niche: data.niche,
    location: data.location,
    createdAt: data.created_at,
    lastRefreshedAt: data.last_refreshed_at,
  };
}

export async function listMarkets(userId: string): Promise<Market[]> {
  const client = await getServiceClient();
  if (!client) return [];

  const { data } = await client
    .from("markets")
    .select("id, name, niche, location, created_at, last_refreshed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    niche: m.niche,
    location: m.location,
    createdAt: m.created_at,
    lastRefreshedAt: m.last_refreshed_at,
  }));
}

export async function touchMarketRefreshedAt(marketId: string): Promise<void> {
  const client = await getServiceClient();
  if (!client) return;
  await client.from("markets").update({ last_refreshed_at: new Date().toISOString() }).eq("id", marketId);
}
