// app/api/sequences/[id]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

// PATCH /api/sequences/[id] — update a step (status, message, date)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const authUser = await getAuthUser();
    const userId = authUser?.id ?? null;

    const { id } = await Promise.resolve(params);
    const stepId = Number(id);
    if (!Number.isFinite(stepId) || stepId <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json() as {
      status?: "pending" | "sent" | "replied" | "skipped";
      message?: string;
      subject?: string;
      scheduledDate?: string;
    };

    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) patch["status"] = body.status;
    if (body.message !== undefined) patch["message"] = body.message;
    if (body.subject !== undefined) patch["subject"] = body.subject;
    if (body.scheduledDate !== undefined) patch["scheduled_date"] = body.scheduledDate;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    let query = supabase
      .from("lead_sequences")
      .update(patch)
      .eq("id", stepId);

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query.select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, step: data });
  } catch (err) {
    console.error("PATCH /api/sequences/[id] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}