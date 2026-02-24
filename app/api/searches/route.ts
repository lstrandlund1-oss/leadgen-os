import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET() {
  if (!supabase) {
    console.warn("Supabase client not initialized in /api/searches.");
    return NextResponse.json({ searches: [] });
  }

  try {
    const { data, error } = await supabase
      .from("searches")
      .select("id, niche, location, company_size, social_presence, created_at")
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
