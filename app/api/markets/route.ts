// app/api/markets/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { createMarket, listMarkets } from "@/lib/markets/markets";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const markets = await listMarkets(authUser.id);
  return NextResponse.json({ markets });
}

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string; niche?: string; location?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const niche = body.niche?.trim();
  const location = body.location?.trim();

  if (!name || !niche || !location) {
    return NextResponse.json({ error: "name, niche, and location are all required" }, { status: 400 });
  }

  const market = await createMarket(authUser.id, name, niche, location);
  if (!market) {
    return NextResponse.json({ error: "Failed to create market" }, { status: 500 });
  }

  return NextResponse.json({ market });
}
