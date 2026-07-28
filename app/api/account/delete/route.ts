// app/api/account/delete/route.ts
// GDPR Article 17 — Right to erasure
//
// Rewritten after a real bug report: account deletion appeared to
// succeed (redirect, client-side sign-out) but the account and all its
// data survived completely intact — a user could log back in with the
// same credentials and land straight on the dashboard.
//
// Root cause, confirmed by tracing the schema: every beta-system table
// (beta_memberships, beta_usage, beta_tutorial_progress,
// beta_lead_feedback, beta_feature_feedback, beta_discount_grants,
// beta_testimonials, analytics_events, beta_invitations) has an explicit
// `user_id uuid references auth.users(id)` foreign key with no cascade
// specified — Postgres blocks deleting the auth user outright while any
// of these rows still reference it. The old code's table list only
// covered 6 tables, missed every one of these, and — worse — silently
// swallowed the resulting deleteUser() failure and returned
// `{ deleted: true }` regardless. It was also using the session-aware
// client for deletes, meaning any table without a DELETE-permitting RLS
// policy (e.g. searches, which only had SELECT/INSERT policies from an
// earlier fix) would silently no-op too.
//
// Fixed: service-role client throughout (bypasses RLS entirely, so a
// missing DELETE policy can't silently block a user's own data from
// being erased), every table that actually references user_id or
// membership_id, correct dependency order, and a real error returned if
// the auth user deletion still fails after everything else succeeds —
// no more lying about success.
//
// Added during this session's verification: support_tickets was missing
// from the user_id-keyed table list despite having a real, populated
// user_id column (app/api/support-chat/route.ts sets it on every ticket)
// — another table that could silently block deletion via FK.

import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServer } from "@/lib/supabaseServer";
import { getServiceClient } from "@/lib/supabaseServiceClient";

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = user.id;

    const admin = await getServiceClient();
    if (!admin) {
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    // Look up the beta membership id first (if any) — several tables key
    // off membership_id rather than user_id directly.
    const { data: membership } = await admin.from("beta_memberships").select("id").eq("user_id", userId).maybeSingle();
    const membershipId = (membership as { id: string } | null)?.id ?? null;

    const errors: string[] = [];

    async function del(table: string, column: string, value: string) {
      const { error } = await admin!.from(table).delete().eq(column, value);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // 1. Tables keyed by membership_id (only relevant if a membership exists)
    if (membershipId) {
      for (const table of [
        "beta_usage",
        "beta_tutorial_progress",
        "beta_lead_feedback",
        "beta_feature_feedback",
        "beta_discount_grants",
        "beta_testimonials",
        "beta_feature_allowances",
      ]) {
        await del(table, "membership_id", membershipId);
      }
    }

    // 2. Tables keyed directly by user_id
    for (const table of [
      "lead_outcomes",
      "outreach_emails",
      "outreach_templates",
      "outreach_usage",
      "lead_sequences",
      "lead_collection_items",
      "lead_collections",
      "deep_scan_usage",
      "deep_search_usage",
      "lead_deep_scans",
      "user_search_runs",
      "searches",
      "analytics_events",
      "support_tickets",
    ]) {
      await del(table, "user_id", userId);
    }

    // 3. beta_invitations.accepted_user_id also FKs to auth.users — clear
    // it rather than deleting the invitation itself (the invitation is
    // historical record, not user data).
    const { error: invErr } = await admin
      .from("beta_invitations")
      .update({ accepted_user_id: null })
      .eq("accepted_user_id", userId);
    if (invErr) errors.push(`beta_invitations: ${invErr.message}`);

    // 4. beta_memberships itself (references auth.users directly)
    if (membershipId) {
      await del("beta_memberships", "id", membershipId);
    }

    // 5. user_profiles — keyed by id, not user_id
    await del("user_profiles", "id", userId);

    if (errors.length > 0) {
      console.error("/api/account/delete — partial failures before auth deletion:", errors);
      return NextResponse.json(
        { error: "Deletion incomplete. Please contact hello@vantioapp.com and mention this error.", details: errors },
        { status: 500 },
      );
    }

    // 6. Only now attempt the actual auth user deletion — every table
    // that could block it via a foreign key has been cleared first.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Auth user deletion failed even after clearing all referencing tables:", deleteError.message);
      return NextResponse.json(
        { error: "Deletion failed. Please contact hello@vantioapp.com and mention this error." },
        { status: 500 },
      );
    }

    // Sign out the server-side session too, as defense-in-depth alongside
    // the client's own sign-out call after this succeeds.
    try {
      const sessionClient = await createSupabaseServer();
      await sessionClient.auth.signOut();
    } catch {
      // Non-fatal — the auth user is already deleted, so any lingering
      // session will fail validation on its next real check regardless.
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("/api/account/delete error:", err);
    return NextResponse.json({ error: "Deletion failed. Please contact hello@vantioapp.com" }, { status: 500 });
  }
}
