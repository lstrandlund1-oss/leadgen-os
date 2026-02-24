// lib/ingest/db.ts
import { supabase } from "@/lib/supabaseClient";
import type { ProviderRecord } from "@/lib/providers/types";
import type { RawCompany } from "@/lib/types";

export type UpsertRawResult = {
  rawIdsBySourceId: Record<string, number>;
  insertedRaw: number;
  skippedDuplicates: number;
};

const IN_CLAUSE_CHUNK_SIZE = 250;

function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return [Array.from(items)];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function upsertCompaniesRaw(records: ProviderRecord[]): Promise<UpsertRawResult> {
  if (!supabase) {
    return { rawIdsBySourceId: {}, insertedRaw: 0, skippedDuplicates: 0 };
  }

  if (records.length === 0) {
    return { rawIdsBySourceId: {}, insertedRaw: 0, skippedDuplicates: 0 };
  }

  // Assumption (enforced): this call is for ONE provider at a time
  const provider = records[0].source;

  // Deduplicate source_ids before prefetch to keep counts deterministic.
  const sourceIds = Array.from(new Set(records.map((r) => r.source_id)));

  // 1) Pre-fetch existing rows (chunked) to compute duplicates deterministically
  const existingMap: Record<string, number> = {};
  try {
    for (const part of chunk(sourceIds, IN_CLAUSE_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("companies_raw")
        .select("id, source_id")
        .eq("source", provider)
        .in("source_id", part);

      if (error) {
        console.error("companies_raw prefetch error:", error.message);
        // Best-effort: stop prefetching further chunks, but still allow upsert below.
        break;
      }

      for (const row of data ?? []) {
        if (row?.source_id != null && typeof row.source_id === "string") {
          existingMap[row.source_id] = row.id as number;
        }
      }
    }
  } catch (e) {
    console.error("companies_raw prefetch exception:", e);
  }

  const skippedDuplicates = Object.keys(existingMap).length;

  // 2) Upsert all records (upsert handles duplicates via onConflict)
  const upsertRows = records.map((r) => {
    const payload: RawCompany = {
      ...r.company,

      // Enforce canonical linkage
      source: r.source,
      sourceId: r.source_id,

      // Preserve verbatim provider payload
      rawPayload: r.raw_payload,
    };

    return {
      source: r.source,
      source_id: r.source_id,
      payload,
    };
  });

  const { data: upserted, error: upsertErr } = await supabase
    .from("companies_raw")
    .upsert(upsertRows, { onConflict: "source,source_id" })
    .select("id, source_id");

  if (upsertErr) {
    console.error("companies_raw bulk upsert error:", upsertErr.message);
    return { rawIdsBySourceId: {}, insertedRaw: 0, skippedDuplicates };
  }

  // 3) Build map source_id -> raw_id
  const rawIdsBySourceId: Record<string, number> = {};
  for (const row of upserted ?? []) {
    if (row?.source_id != null) {
      rawIdsBySourceId[row.source_id as string] = row.id as number;
    }
  }

  // inserted = returned - duplicates (best-effort)
  const insertedRaw = Math.max((upserted?.length ?? 0) - skippedDuplicates, 0);

  return { rawIdsBySourceId, insertedRaw, skippedDuplicates };
}

