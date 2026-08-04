// app/api/markets/best-opportunities/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBestUncontactedOpportunities } from "@/lib/markets/getBestUncontactedOpportunities";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const opportunities = await getBestUncontactedOpportunities(authUser.id);
  return NextResponse.json({ opportunities });
}
