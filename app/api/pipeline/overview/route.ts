// app/api/pipeline/overview/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getPipelineOverview } from "@/lib/pipeline/getPipelineOverview";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overview = await getPipelineOverview(authUser.id);
  return NextResponse.json(overview);
}
