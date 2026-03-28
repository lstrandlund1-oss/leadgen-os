// app/api/sequences/route.ts
import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
import { buildStrategyBrief } from "@/lib/outreach/strategyBrief";
import { generateSequence } from "@/lib/sequences/generateSequence";
import type { OutreachRequest } from "@/lib/outreach/types";

// GET /api/sequences?leadId=X — fetch all steps for a lead
export async function GET(request: Request) {
  try {
    if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    const authUser = await getAuthUser();
    const userId = authUser?.id ?? null;

    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get("leadId");
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    let query = supabase
      .from("lead_sequences")
      .select("*")
      .eq("lead_id", leadId)
      .order("step", { ascending: true });

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ steps: data ?? [] });
  } catch (err) {
    console.error("GET /api/sequences error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/sequences — generate a new sequence for a lead
export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    const authedSupabase = await createSupabaseServer();
    const { data: { user } } = await authedSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as {
      leadId: string;
      runId: number;
      companyName: string;
      outreachRequest: OutreachRequest;
      opportunity: number;
      fitScore: number;
      riskProfile: string;
      startDate?: string; // ISO date — defaults to today
    };

    if (!body.leadId || !body.companyName) {
      return NextResponse.json({ error: "leadId and companyName required" }, { status: 400 });
    }

    // Delete any existing sequence for this lead (regenerate)
    if (supabase) {
      await supabase
        .from("lead_sequences")
        .delete()
        .eq("lead_id", body.leadId)
        .eq("user_id", user.id);
    }

    // Inject user profile
    const { data: profileRow } = await authedSupabase
      .from("user_profiles")
      .select("profile_data")
      .eq("id", user.id)
      .single();

    const userProfile = profileRow?.profile_data ?? {};
    body.outreachRequest.user_profile = {
      profileType: userProfile.profileType ?? null,
      businessName: userProfile.businessName ?? null,
      capabilities: userProfile.capabilities ?? {},
      acquisitionStyle: userProfile.acquisitionStyle ?? "balanced",
    };

    // Build strategy brief (deterministic — same as outreach generation)
    const brief = buildStrategyBrief(body.outreachRequest);

    // Generate sequence via AI
    const sequence = await generateSequence(
      brief,
      body.opportunity,
      body.fitScore,
      body.riskProfile,
      apiKey,
    );

    // Calculate actual dates from day offsets
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    startDate.setHours(0, 0, 0, 0);

    // Persist all steps
    const rows = sequence.steps.map(step => {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + (step.day - 1));

      return {
        lead_id: body.leadId,
        run_id: body.runId,
        user_id: user.id,
        company_name: body.companyName,
        step: step.step,
        day_offset: step.day,
        scheduled_date: scheduledDate.toISOString().split("T")[0],
        channel: step.channel,
        subject: step.subject ?? null,
        message: step.message,
        objective: step.objective,
        cta: step.cta,
        status: "pending",
        cadence_type: sequence.cadence_type,
      };
    });

    if (!supabase) {
      // Return without persisting if no DB
      return NextResponse.json({ ok: true, sequence, rows });
    }

    const { data: inserted, error } = await supabase
      .from("lead_sequences")
      .insert(rows)
      .select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      sequence,
      steps: inserted,
      reasoning: sequence.reasoning,
      cadenceType: sequence.cadence_type,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("POST /api/sequences error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}