// app/api/waitlist/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getServiceClient } from "@/lib/supabaseServiceClient";

export async function GET() {
  try {
    // RLS blocks anon SELECT on this table (public signups shouldn't be
    // readable by any client key) — this aggregate count is a legitimate
    // server-side need, so it uses the service-role client instead.
    const serviceClient = await getServiceClient();
    if (!serviceClient) return NextResponse.json({ count: 0 });
    const { count, error } = await serviceClient.from("waitlist").select("*", { count: "exact", head: true });
    if (error) return NextResponse.json({ count: 0 });
    return NextResponse.json(
      { count: count ?? 0 },
      {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
      },
    );
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, plan } = (await request.json()) as { email?: string; plan?: string };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (!supabase) {
      // No DB configured — still return success (useful in local dev)
      console.log("Waitlist signup (no DB):", email, plan);
      return NextResponse.json({ joined: true });
    }

    const { error } = await supabase.from("waitlist").upsert(
      {
        email: email.toLowerCase().trim(),
        plan: plan ?? "scout",
        beta_user: true,
        beta_plan: plan ?? "scout",
        beta_join_date: new Date().toISOString(),
        beta_source: "waitlist",
        created_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );

    if (error) {
      // Table may not exist yet — log but don't fail the user
      console.warn("Waitlist upsert error:", error.message);
    }

    return NextResponse.json({ joined: true });
  } catch (err) {
    console.error("/api/waitlist POST error:", err);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}
