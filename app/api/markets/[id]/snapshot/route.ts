// app/api/markets/[id]/snapshot/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getMarketSnapshot } from "@/lib/markets/getMarketSnapshot";

export async function GET(_request: Request, { params }: { params: { id: string } | Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const marketId = resolvedParams.id;

  const snapshot = await getMarketSnapshot(authUser.id, marketId);
  if (!snapshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
