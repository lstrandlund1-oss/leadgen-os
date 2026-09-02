#!/usr/bin/env node
/**
 * File a report into the Vantio Command Center's Discoveries inbox.
 *
 * Use this whenever something worth documenting comes up while working on
 * Vantio Revenue — a bug, a risk, an idea, a decision worth recording — and
 * you don't want it to disappear once this repo/session is closed. It lands
 * in the Command Center as a discovery tagged "revenue-report" (see the
 * "From Vantio Revenue" badge on /work/discoveries), locked to
 * classification "Needs Review" so it always goes through triage before it
 * can jump the queue as "Fix Now". From there it can be promoted into a
 * tracked task like any other discovery.
 *
 * Usage:
 *   node scripts/report-to-command-center.mjs "<title>" "<description>" [severity] [type]
 *
 *   severity — low | medium | high | critical (default: medium)
 *   type     — a short free-text label, e.g. Bug | Idea | Risk | Decision (default: Idea)
 *
 * Requires two env vars, set locally (.env.local) or in Vercel:
 *   COMMAND_CENTER_SUPABASE_URL
 *   COMMAND_CENTER_SUPABASE_ANON_KEY
 *
 * These point at the Command Center's Supabase project, not this app's own.
 * The anon key is intentionally narrow: an insert-only RLS policy lets it
 * write rows into cc_discoveries shaped exactly like this script's payload
 * (source="revenue-report", product_id="revenue", classification="Needs
 * Review") and nothing else — it cannot read, update or delete anything, in
 * this table or any other. See the vantiocc repo, migration
 * add_discovery_source_and_external_report_insert_policy, for the policy
 * itself.
 */
import { createClient } from "@supabase/supabase-js";

const [, , title, description = "", severityArg, typeArg] = process.argv;

if (!title) {
  console.error(
    'Usage: node scripts/report-to-command-center.mjs "<title>" "<description>" [severity] [type]'
  );
  process.exit(1);
}

const url = process.env.COMMAND_CENTER_SUPABASE_URL;
const key = process.env.COMMAND_CENTER_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing COMMAND_CENTER_SUPABASE_URL / COMMAND_CENTER_SUPABASE_ANON_KEY in the environment."
  );
  process.exit(1);
}

const severity = ["low", "medium", "high", "critical"].includes(severityArg)
  ? severityArg
  : "medium";
const type = typeArg || "Idea";

const supabase = createClient(url, key, { auth: { persistSession: false } });

const { error } = await supabase.from("cc_discoveries").insert({
  title,
  description,
  type,
  severity,
  source: "revenue-report",
  product_id: "revenue",
  classification: "Needs Review",
  classification_reason:
    "Filed from leadgen-os via report-to-command-center.mjs; awaiting triage.",
});

if (error) {
  console.error("Failed to file report:", error.message);
  process.exit(1);
}

console.log(`Reported to Command Center: "${title}"`);
