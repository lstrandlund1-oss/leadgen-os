// app/api/outcomes/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type OutcomePayload = {
  runId: number;
  leadId: string;

  contacted?: boolean;
  replied?: boolean;
  bookedCall?: boolean;
  closed?: boolean;
  revenue?: number | null;
  notes?: string | null;
};

export async function POST(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as OutcomePayload;

    if (!Number.isFinite(body.runId) || body.runId <= 0 || !body.leadId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const payload = {
      run_id: body.runId,
      lead_id: body.leadId,
      user_id: null, // auth later

      contacted: body.contacted ?? false,
      replied: body.replied ?? false,
      booked_call: body.bookedCall ?? false,
      closed: body.closed ?? false,

      revenue: body.revenue ?? null,
      notes: body.notes ?? null,
    };

    const { data, error } = await supabase
      .from("lead_outcomes")
      .upsert(payload, { onConflict: "run_id,lead_id,user_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, outcome: data }, { status: 200 });
  } catch (err) {
    console.error("POST /api/outcomes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const runId = Number(searchParams.get("runId"));

    if (!Number.isFinite(runId) || runId <= 0) {
      return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("lead_outcomes")
      .select("*")
      .eq("run_id", runId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outcomes: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/outcomes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
