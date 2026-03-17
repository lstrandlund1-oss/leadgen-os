import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get("collection_id");
    if (!collectionId) return NextResponse.json({ items: [] });
    const { data } = await supabase.from("lead_collection_items").select("*").eq("collection_id", collectionId).eq("user_id", user.id).order("added_at", { ascending: false });
    return NextResponse.json({ items: data ?? [] });
  } catch { return NextResponse.json({ items: [] }); }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json() as { collection_id: string; lead_id: string; run_id?: number; company_name?: string; notes?: string };
    const { data, error } = await supabase.from("lead_collection_items").insert({ ...body, user_id: user.id }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await request.json() as { id: string };
    await supabase.from("lead_collection_items").delete().eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}