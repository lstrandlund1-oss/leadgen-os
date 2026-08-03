// app/api/markets/[id]/refresh/route.ts
//
// Triggers a real search (same pipeline as a standard dashboard search,
// including geographic partitioning) tagged to this market, so its
// snapshot stats reflect newly-discovered companies. Reuses
// executeAndRespond directly rather than duplicating the search logic.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { executeAndRespond } from "@/lib/search/executeSearch";
import { listMarkets, touchMarketRefreshedAt } from "@/lib/markets/markets";

export async function POST(_request: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const marketId = resolvedParams.id;

  // Confirm this market belongs to the requesting user before running a
  // search on their behalf tagged to it.
  const markets = await listMarkets(authUser.id);
  const market = markets.find((m) => m.id === marketId);
  if (!market) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const queries = [
    market.niche,
    `${market.niche} ${market.location}`,
    `${market.niche} i ${market.location}`,
    `bästa ${market.niche} ${market.location}`,
  ];

  const result = await executeAndRespond(queries, market.location, "any", "standard", null, authUser.id, marketId);
  await touchMarketRefreshedAt(marketId);

  return NextResponse.json(result);
}
