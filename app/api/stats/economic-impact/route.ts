// app/api/stats/economic-impact/route.ts
import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { computeEconomicImpact } from "@/lib/stats/economicImpact";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("user_profiles").select("profile_data").eq("id", authUser.id).maybeSingle();

  const profileData = data?.profile_data as { averageDealValue?: number } | null;
  const impact = profileData?.averageDealValue ? computeEconomicImpact(profileData.averageDealValue) : null;

  return NextResponse.json({ impact });
}
