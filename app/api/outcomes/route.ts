// app/api/outcomes/route.ts
import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { logEvent } from "@/lib/analytics/log";

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
  followupDate?: string | null;
  lostReason?: "no_response" | "not_interested" | "has_provider" | "wrong_timing" | null;
  scoreAtOutreach?: number | null;
};

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  const userId = authUser?.id ?? null;
  try {
    const supabase = await createSupabaseServer();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as OutcomePayload;

    if (!Number.isFinite(body.runId) || body.runId <= 0 || !body.leadId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Fetch the existing row so this save can merge rather than overwrite.
    // Previously, any field not included in this specific request body was
    // defaulted to false/null — meaning a save that only toggled `closed`
    // would silently reset `contacted`/`replied` back to false in the
    // database, even though the client's own optimistic UI update correctly
    // preserved them. This also doubles as the basis for transition
    // detection below.
    const { data: existing } = await supabase
      .from("lead_outcomes")
      .select("*")
      .eq("run_id", body.runId)
      .eq("lead_id", body.leadId)
      .eq("user_id", userId)
      .maybeSingle();

    const merged = {
      contacted: body.contacted !== undefined ? body.contacted : (existing?.contacted ?? false),
      replied: body.replied !== undefined ? body.replied : (existing?.replied ?? false),
      booked_call: body.bookedCall !== undefined ? body.bookedCall : (existing?.booked_call ?? false),
      closed: body.closed !== undefined ? body.closed : (existing?.closed ?? false),
      revenue: body.revenue !== undefined ? body.revenue : (existing?.revenue ?? null),
      notes: body.notes !== undefined ? body.notes : (existing?.notes ?? null),
      tonality: body.tonality !== undefined ? body.tonality : (existing?.tonality ?? null),
      angle_type: body.angleType !== undefined ? body.angleType : (existing?.angle_type ?? null),
      followup_date: body.followupDate !== undefined ? body.followupDate : (existing?.followup_date ?? null),
      lost_reason: body.lostReason !== undefined ? body.lostReason : (existing?.lost_reason ?? null),
      score_at_outreach:
        body.scoreAtOutreach !== undefined ? body.scoreAtOutreach : (existing?.score_at_outreach ?? null),
    };

    // Transition detection: a stage's timestamp is set once, the first
    // time it becomes true, and a specific event is logged for it — rather
    // than one generic "outcome_recorded" on every save regardless of what
    // actually changed. This is what makes "Contacted: Aug 12 -> Replied:
    // Aug 14" reconstructable later instead of only ever knowing current
    // state.
    const now = new Date().toISOString();
    const newlyContacted = merged.contacted && !existing?.contacted;
    const newlyReplied = merged.replied && !existing?.replied;
    const newlyBooked = merged.booked_call && !existing?.booked_call;
    const newlyClosed = merged.closed && !existing?.closed;

    const payload = {
      run_id: body.runId,
      lead_id: body.leadId,
      user_id: userId,
      ...merged,
      contacted_at: newlyContacted ? now : (existing?.contacted_at ?? null),
      replied_at: newlyReplied ? now : (existing?.replied_at ?? null),
      booked_call_at: newlyBooked ? now : (existing?.booked_call_at ?? null),
      closed_at: newlyClosed ? now : (existing?.closed_at ?? null),
    };

    const { data, error } = await supabase
      .from("lead_outcomes")
      .upsert(payload, { onConflict: "run_id,lead_id,user_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const eventContext = { runId: body.runId, leadId: body.leadId };
    if (newlyContacted) await logEvent(userId, "contacted", eventContext);
    if (newlyReplied) await logEvent(userId, "replied", eventContext);
    if (newlyBooked) await logEvent(userId, "meeting_booked", eventContext);
    if (newlyClosed) {
      const won = !merged.lost_reason;
      await logEvent(userId, won ? "closed_won" : "closed_lost", {
        ...eventContext,
        revenue: won ? merged.revenue : undefined,
      });
      if (won && merged.revenue) {
        await logEvent(userId, "revenue_recorded", { ...eventContext, revenue: merged.revenue });
      }
    }
    // Always still logged, for anything that changed but isn't a stage
    // transition (notes, follow-up date, etc.) — same generic event as
    // before, just no longer the ONLY signal for actual pipeline movement.
    await logEvent(userId, "outcome_recorded", eventContext);

    return NextResponse.json({ ok: true, outcome: data }, { status: 200 });
  } catch (err) {
    console.error("POST /api/outcomes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUser();
    const userId = authUser?.id ?? null;

    // Both query paths below return outcome data (revenue, notes, contact
    // status) that must be scoped to the requesting user. Previously,
    // (a) an unauthenticated request to ?all=true returned every user's
    // outcomes unfiltered, and (b) the per-run path never checked user_id
    // at all, for anyone — meaning any visitor could enumerate run_id
    // values and read any user's private outcome data. Both are fixed by
    // requiring authentication up front and always filtering by user_id.
    // Also fixed here: this previously used the anon-key client, which
    // never carries a session — since lead_outcomes' RLS policy requires
    // auth.uid() = user_id, and auth.uid() is always null for that client,
    // the user_id filter alone was never actually sufficient; the query
    // itself was being blocked by RLS regardless.
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = await createSupabaseServer();

    const { searchParams } = new URL(request.url);
    const runIdParam = searchParams.get("runId");
    const allRuns = searchParams.get("all") === "true";

    // User-scoped all-runs query (for profile stats)
    if (allRuns) {
      const { data, error } = await supabase.from("lead_outcomes").select("*").eq("user_id", userId);
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

    const { data, error } = await supabase.from("lead_outcomes").select("*").eq("run_id", runId).eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outcomes: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("GET /api/outcomes error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
