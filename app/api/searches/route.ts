import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    // Matches the graceful-degradation pattern the dashboard already
    // expects from this endpoint (empty array, not an error banner).
    return NextResponse.json({ searches: [] });
  }

  try {
    const authedSupabase = await createSupabaseServer();
    const { data, error } = await authedSupabase
      .from("searches")
      .select("id, niche, location, company_size, social_presence, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Supabase select error:", error.message);
      return NextResponse.json({ searches: [] });
    }

    return NextResponse.json({ searches: data || [] });
  } catch (e) {
    console.error("Supabase exception /api/searches:", e);
    return NextResponse.json({ searches: [] });
  }
}
