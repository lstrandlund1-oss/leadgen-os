// app/api/stats/monthly/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getMonthlyPerformance } from "@/lib/stats/getMonthlyPerformance";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const performance = await getMonthlyPerformance(authUser.id);
  return NextResponse.json(performance);
}
