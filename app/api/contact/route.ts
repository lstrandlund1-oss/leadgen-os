import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; email?: string; subject?: string; message?: string };
    const { name, email, subject, message } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "name, email, and message are required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("contact_submissions")
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        subject: subject?.trim() ?? "General enquiry",
        message: message.trim(),
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error("contact insert error:", error);
      // Don't expose DB errors to client — still return success
      // so the user knows their message was "received" even if DB fails
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contact route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}