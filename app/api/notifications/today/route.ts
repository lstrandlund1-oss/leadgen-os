import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getTodaysWork } from "@/lib/notifications/getTodaysWork";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const items = await getTodaysWork(user.id);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
