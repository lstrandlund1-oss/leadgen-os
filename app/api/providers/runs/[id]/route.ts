// app/api/providers/runs/[id]/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client not configured" }, { status: 500 });
    }

    const { id } = await Promise.resolve(params);
    const runId = Number(id);

    if (!Number.isFinite(runId) || runId <= 0) {
      return NextResponse.json({ error: "Invalid run id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("provider_runs")
      .select("*")
      .eq("id", runId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("/api/providers/runs/[id] GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

