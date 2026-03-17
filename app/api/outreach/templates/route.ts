// app/api/outreach/templates/route.ts
// CRUD for user's saved outreach message templates.
// Stored in Supabase outreach_templates table (user-scoped).
// Falls back to localStorage-synced client storage if table doesn't exist.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("outreach_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ templates: [] }); // table may not exist yet
    return NextResponse.json({ templates: data ?? [] });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as {
      name: string;
      channel: string;
      subject?: string;
      body: string;
      tone?: string;
    };

    if (!body.name || !body.body) {
      return NextResponse.json({ error: "name and body required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("outreach_templates")
      .insert({
        user_id: user.id,
        name: body.name,
        channel: body.channel ?? "email",
        subject: body.subject ?? null,
        body: body.body,
        tone: body.tone ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await request.json() as { id: string };
    await supabase.from("outreach_templates").delete().eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}