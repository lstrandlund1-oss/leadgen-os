import type { ProviderAdapter, ProviderRecord, ProviderResult } from "./types";

export function assertProviderResult(
  adapter: ProviderAdapter,
  result: ProviderResult
): asserts result is Extract<ProviderResult, { ok: true }> {
  if (!result || typeof result !== "object") {
    throw new Error(`[${adapter.name}] provider returned invalid result`);
  }

  if (!("ok" in result)) {
    throw new Error(`[${adapter.name}] provider result missing 'ok' flag`);
  }

  if (result.ok !== true) {
    const msg = getProviderErrorMessage(result);
    throw new Error(`[${adapter.name}] ${msg}`);
  }

  if (!Array.isArray(result.records)) {
    throw new Error(`[${adapter.name}] ok=true but records is not an array`);
  }

  if (!result.meta || typeof result.meta !== "object") {
    throw new Error(`[${adapter.name}] ok=true but meta missing`);
  }

  for (const [i, rec] of result.records.entries()) {
    assertProviderRecord(adapter.name, rec, i);
  }
}

function getProviderErrorMessage(result: ProviderResult): string {
  if (result.ok === true) return "Provider failed";

  const err = result.error;
  if (err && typeof err === "object" && typeof err.message === "string" && err.message.trim()) {
    return err.message;
  }
  return "Provider failed";
}

function assertProviderRecord(provider: string, rec: ProviderRecord, i: number): void {
  if (!rec) throw new Error(`[${provider}] record[${i}] is null/undefined`);

  if (!rec.source || !rec.source_id) {
    throw new Error(`[${provider}] record[${i}] missing source/source_id`);
  }

  if (!rec.company) {
    throw new Error(`[${provider}] record[${i}] missing company`);
  }

  const c: unknown = rec.company;

  if (!c || typeof c !== "object") {
    throw new Error(`[${provider}] record[${i}] company is invalid`);
  }

  const obj = c as Record<string, unknown>;
  const source = obj.source;
  const sourceId = obj.sourceId;
  const name = obj.name;
  const categories = obj.categories;

  if (typeof source !== "string" || typeof sourceId !== "string" || typeof name !== "string") {
    throw new Error(`[${provider}] record[${i}] company missing source/sourceId/name`);
  }

  if (!Array.isArray(categories)) {
    throw new Error(`[${provider}] record[${i}] company.categories must be an array`);
  }
}

