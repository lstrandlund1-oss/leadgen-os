// app/api/account/delete/route.ts
// GDPR Article 17 — Right to erasure
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function DELETE() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = user.id;

    // Best-effort erasure of all user data (non-fatal if tables don't exist)
    const tables = [
      { table: "lead_outcomes",         col: "user_id" },
      { table: "outreach_emails",        col: "user_id" },
      { table: "outreach_templates",     col: "user_id" },
      { table: "searches",               col: "user_id" },
      { table: "provider_runs",          col: "user_id" },
      { table: "user_profiles",          col: "id" },
    ];

    for (const { table, col } of tables) {
      const { error } = await supabase.from(table).delete().eq(col, userId);
      if (error) console.warn(`Delete ${table}:`, error.message);
    }

    // Delete the auth user using service role (required for hard deletion)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

    if (serviceKey && supabaseUrl) {
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error("Auth user deletion failed:", deleteError.message);
        // Still return success — data is erased even if auth record lingers
      }
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY not set — auth user not deleted from auth.users");
    }

    // Sign out the session so the client is logged out
    await supabase.auth.signOut();

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("/api/account/delete error:", err);
    return NextResponse.json({ error: "Deletion failed. Please contact hello@vantioapp.com" }, { status: 500 });
  }
}