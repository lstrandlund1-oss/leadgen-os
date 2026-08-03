// app/api/stats/daily-summary/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getDailySummary } from "@/lib/stats/getDailySummary";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getDailySummary(authUser.id);
  return NextResponse.json(summary);
}
