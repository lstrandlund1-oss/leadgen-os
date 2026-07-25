// app/api/deep-scan/route.ts
//
// GET  /api/deep-scan?sourceId=xxx        — fetch saved deep scan for a lead
// POST /api/deep-scan                     — save / upsert deep scan for a lead

import { NextResponse } from "next/server";

async function getClient() {
  const { supabase } = await import("@/lib/supabaseClient");
  return supabase;
}

// Returns null if unauthenticated — callers must reject the request rather
// than silently falling back to a shared placeholder identity, which was
// the previous behavior (a hardcoded "user_v1" string for any failed/
// missing auth check).
async function getUserId(): Promise<string | null> {
  try {
    const { getAuthUser } = await import("@/lib/supabaseServer");
    const user = await getAuthUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get("sourceId");

    if (!sourceId) {
      return NextResponse.json({ error: "sourceId required" }, { status: 400 });
    }

    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getClient();
    if (!supabase) return NextResponse.json({ data: null });

    const { data, error } = await supabase
      .from("lead_deep_scans")
      .select("*")
      .eq("source_id", sourceId)
      .eq("user_id", userId)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("deep-scan GET error:", error);
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("deep-scan GET exception:", err);
    return NextResponse.json({ data: null });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sourceId: string;
      leadId: string;
      scanResult: {
        deepScore: number;
        pageReachable: boolean;
        website: { scores: Record<string, number>; summary: string; signalCount: number };
        market: {
          scores: Record<string, number>;
          competitorSummary: string;
          recommendation: string;
          signalCount: number;
        };
        brand: {
          scores: Record<string, number>;
          brandGrade: string;
          weakestArea: string;
          strengthArea: string;
          signalCount: number;
        };
      };
      // Derived signals used for rescoring — stored so we never need to re-derive
      derivedSignals: {
        hasBookingCta: boolean | null;
        hasClearOffer: boolean | null;
        isMobileFriendly: boolean | null;
        websiteReachable: boolean;
      };
    };

    if (!body.sourceId || !body.scanResult) {
      return NextResponse.json({ error: "sourceId + scanResult required" }, { status: 400 });
    }

    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getClient();
    if (!supabase) return NextResponse.json({ success: false, error: "No DB" });

    const { error } = await supabase.from("lead_deep_scans").upsert(
      {
        source_id: body.sourceId,
        lead_id: body.leadId,
        user_id: userId,
        scan_result: body.scanResult,
        derived_signals: body.derivedSignals,
        scanned_at: new Date().toISOString(),
      },
      {
        onConflict: "source_id,user_id",
      },
    );

    if (error) {
      console.error("deep-scan POST error:", error);
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("deep-scan POST exception:", err);
    return NextResponse.json({ success: false, error: "Internal error" });
  }
}
