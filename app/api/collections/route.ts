import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data } = await supabase.from("lead_collections").select("*, lead_collection_items(count)").eq("user_id", user.id).order("created_at", { ascending: false });
    return NextResponse.json({ collections: data ?? [] });
  } catch { return NextResponse.json({ collections: [] }); }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json() as { name: string; description?: string; color?: string };
    if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    const { data, error } = await supabase.from("lead_collections").insert({ user_id: user.id, name: body.name.trim(), description: body.description ?? null, color: body.color ?? "#c9a84c" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ collection: data });
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await request.json() as { id: string };
    await supabase.from("lead_collections").delete().eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }); }
}