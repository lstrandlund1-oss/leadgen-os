// app/api/stats/insight/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getDailyInsight } from "@/lib/stats/getDailyInsight";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const insight = await getDailyInsight(authUser.id);
  return NextResponse.json({ insight });
}
