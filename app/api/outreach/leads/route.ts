// app/api/outreach/leads/route.ts
// Returns a flat list of all saved leads for the current user across all runs.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

type NormalizedRow = { raw_id: number; name: string | null; website: string | null; city: string | null };
type ClassificationRow = { raw_id: number; primary_industry: string | null };
type RunRawRow = { raw_id: number; run_id: number };

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Recent runs for this user
    const { data: runs, error: runsErr } = await supabase
      .from("provider_runs").select("id").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20);
    if (runsErr || !runs?.length) return NextResponse.json({ leads: [] });

    const runIds = (runs as { id: number }[]).map(r => r.id);

    // 2. All raw_ids in those runs
    const { data: runRaws } = await supabase
      .from("provider_run_raws").select("raw_id, run_id").in("run_id", runIds).limit(300);
    if (!runRaws?.length) return NextResponse.json({ leads: [] });

    const rows = runRaws as RunRawRow[];
    const rawIds = [...new Set(rows.map(r => r.raw_id))];
    const rawToRun: Record<number, number> = {};
    for (const r of rows) { if (!rawToRun[r.raw_id]) rawToRun[r.raw_id] = r.run_id; }

    // 3. Normalized names/city/website
    const { data: normalized } = await supabase
      .from("companies_normalized").select("raw_id, name, website, city").in("raw_id", rawIds);
    const normMap: Record<number, NormalizedRow> = {};
    for (const n of (normalized ?? []) as NormalizedRow[]) normMap[n.raw_id] = n;

    // 4. Raw payload for rating/reviews/social
    const { data: rawRows } = await supabase
      .from("companies_raw").select("id, payload").in("id", rawIds);
    const rawMap: Record<number, Record<string, unknown>> = {};
    for (const r of (rawRows ?? []) as { id: number; payload: unknown }[]) {
      rawMap[r.id] = (r.payload ?? {}) as Record<string, unknown>;
    }

    // 5. Industry from classifications
    const { data: classifications } = await supabase
      .from("company_classifications").select("raw_id, primary_industry").in("raw_id", rawIds);
    const classMap: Record<number, string | null> = {};
    for (const c of (classifications ?? []) as ClassificationRow[]) classMap[c.raw_id] = c.primary_industry;

    // 6. Assemble deduplicated list
    const seen = new Set<string>();
    const leads = [];
    for (const rawId of rawIds) {
      const norm = normMap[rawId];
      if (!norm) continue;
      const name = norm.name ?? "Unknown";
      const city = norm.city ?? null;
      const key = `${name.toLowerCase()}|${city?.toLowerCase() ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const raw = rawMap[rawId] ?? {};
      leads.push({
        id: String(rawId),
        run_id: rawToRun[rawId] ?? 0,
        company_name: name,
        industry: classMap[rawId] ?? (Array.isArray(raw.categories) ? raw.categories[0] : null),
        city,
        website: norm.website ?? null,
        rating: typeof raw.rating === "number" ? raw.rating : null,
        review_count: typeof raw.review_count === "number" ? raw.review_count : null,
        social_presence: typeof raw.social_presence === "string" ? raw.social_presence : null,
      });
    }

    return NextResponse.json({ leads });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}