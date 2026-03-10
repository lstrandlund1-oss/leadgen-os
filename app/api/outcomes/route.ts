// app/api/outcomes/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
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
  tonality?: "soft" | "direct" | null;
  angleType?: string | null;
};

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  const userId = authUser?.id ?? null;
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
      user_id: userId,

      contacted: body.contacted ?? false,
      replied: body.replied ?? false,
      booked_call: body.bookedCall ?? false,
      closed: body.closed ?? false,

      revenue: body.revenue ?? null,
      notes: body.notes ?? null,
      tonality: body.tonality ?? null,
      angle_type: body.angleType ?? null,
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

    const authUser = await getAuthUser();
    const userId = authUser?.id ?? null;

    const { searchParams } = new URL(request.url);
    const runIdParam = searchParams.get("runId");
    const allRuns = searchParams.get("all") === "true";

    // User-scoped all-runs query (for profile stats)
    if (allRuns) {
      let query = supabase.from("lead_outcomes").select("*");
      if (userId) query = query.eq("user_id", userId);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ outcomes: data ?? [] }, { status: 200 });
    }

    // Per-run query (for dashboard tracking tab)
    const runId = Number(runIdParam);
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