// app/api/stats/goal/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getSuggestedGoal } from "@/lib/stats/getSuggestedGoal";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goal = await getSuggestedGoal(authUser.id);
  return NextResponse.json({ goal });
}
