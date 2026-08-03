// app/api/recommendations/today/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getTodaysRecommendations } from "@/lib/recommendations/getTodaysRecommendations";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recommendations = await getTodaysRecommendations(authUser.id, 5);
  return NextResponse.json({ recommendations });
}
