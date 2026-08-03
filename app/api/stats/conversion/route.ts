// app/api/stats/conversion/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getConversionFunnel } from "@/lib/stats/getConversionFunnel";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const funnel = await getConversionFunnel(authUser.id);
  return NextResponse.json(funnel);
}
