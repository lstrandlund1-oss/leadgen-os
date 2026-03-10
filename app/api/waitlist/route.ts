// app/api/waitlist/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const { email, plan } = await request.json() as { email?: string; plan?: string };

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
        plan: plan ?? "pro",
        created_at: new Date().toISOString(),
      },
      { onConflict: "email" }
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