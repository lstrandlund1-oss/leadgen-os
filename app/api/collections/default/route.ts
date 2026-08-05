// app/api/collections/default/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

const DEFAULT_COLLECTION_NAME = "Saved Leads";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: existing } = await supabase
      .from("lead_collections")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", DEFAULT_COLLECTION_NAME)
      .maybeSingle();

    if (existing) return NextResponse.json({ collectionId: existing.id });

    const { data: created, error } = await supabase
      .from("lead_collections")
      .insert({ user_id: user.id, name: DEFAULT_COLLECTION_NAME, color: "#c9a84c" })
      .select("id")
      .single();

    if (error || !created) return NextResponse.json({ error: "Failed to create default collection" }, { status: 500 });

    return NextResponse.json({ collectionId: created.id });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
