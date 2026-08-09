import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getServiceClient } from "@/lib/supabaseServiceClient";
import { computeMonthlyPerformanceDetail, type OutcomeForMonthlyDetail } from "@/lib/stats/getMonthlyPerformanceDetail";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = await getServiceClient();
    if (!client) return NextResponse.json({ days: [] });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const { data: outcomes } = await client
      .from("lead_outcomes")
      .select("contacted_at, replied_at, booked_call_at, closed_at, closed, lost_reason, revenue")
      .eq("user_id", user.id);

    const days = computeMonthlyPerformanceDetail((outcomes ?? []) as OutcomeForMonthlyDetail[], monthStartIso);
    return NextResponse.json({ days });
  } catch {
    return NextResponse.json({ days: [] });
  }
}
