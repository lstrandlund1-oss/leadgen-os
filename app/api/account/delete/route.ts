// app/api/account/delete/route.ts
// GDPR Article 17 — Right to erasure
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export async function DELETE() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (!supabase) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

    const userId = user.id;

    // Best-effort erasure of all user data
    for (const { table, col } of [
      { table: "lead_outcomes", col: "user_id" },
      { table: "searches", col: "user_id" },
      { table: "provider_runs", col: "user_id" },
      { table: "user_profiles", col: "id" },
    ]) {
      const { error } = await supabase.from(table).delete().eq(col, userId);
      if (error) console.warn(`Delete ${table}:`, error.message);
    }

    // Delete auth user (requires SUPABASE_SERVICE_ROLE_KEY)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(
        process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await admin.auth.admin.deleteUser(userId);
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("/api/account/delete error:", err);
    return NextResponse.json({ error: "Deletion failed" }, { status: 500 });
  }
}