// app/api/providers/runs/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import type { ProviderName } from "@/lib/providers/types";

const PROVIDERS: ProviderName[] = ["mock", "google_places", "serp"];
const STATUSES = ["running", "success", "error"] as const;
type RunStatus = (typeof STATUSES)[number];

export async function GET(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
    }

    const url = new URL(request.url);

    const providerParam = (url.searchParams.get("provider") ?? "").trim();
    const statusParam = (url.searchParams.get("status") ?? "").trim();
    const limitParam = (url.searchParams.get("limit") ?? "").trim();

    const limit = clamp(parseInt(limitParam, 10), 25, 1, 100);

    const provider: ProviderName | null =
      providerParam && PROVIDERS.includes(providerParam as ProviderName)
        ? (providerParam as ProviderName)
        : null;

    const status: RunStatus | null =
      statusParam && (STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as RunStatus)
        : null;

    let q = supabase
      .from("provider_runs")
      .select(
        [
          "id",
          "provider",
          "intent_hash",
          "request_id",
          "status",
          "fetched_count",
          "returned_count",
          "inserted_raw",
          "skipped_duplicates",
          "next_cursor",
          "exhausted",
          "created_at",
          "started_at",
          "finished_at",
          "error_code",
          "error_message",
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (provider) q = q.eq("provider", provider);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;

    if (error) {
      console.error("provider_runs list error:", error.message);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    return NextResponse.json({ runs: data ?? [] }, { status: 200 });
  } catch (err) {
    console.error("/api/providers/runs GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function clamp(n: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

