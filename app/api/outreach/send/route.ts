// app/api/outreach/send/route.ts
// Send an outreach email via Resend on behalf of the user.
// The email is sent FROM hello@vantioapp.com (or user's configured sender)
// and logged to Supabase for tracking.

import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { sendEmail } from "@/lib/email/send";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as {
      to: string;
      subject: string;
      body: string;
      lead_id?: string;
      run_id?: number;
      company_name?: string;
    };

    if (!body.to || !body.subject || !body.body) {
      return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
    }

    // Basic email validation
    if (!body.to.includes("@")) {
      return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
    }

    // Get user profile for sender name
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("profile_data")
      .eq("id", user.id)
      .maybeSingle();

    const profileRecord = profileData?.profile_data as Record<string, unknown> | null;
    const businessName = (profileRecord?.businessName as string) ?? null;
    const senderName = businessName ?? user.email?.split("@")[0] ?? "Vantio User";

    // Send via Resend
    const result = await sendEmail({
      to: body.to,
      subject: body.subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
        ${body.body.split("\n").map((line: string) =>
          line.trim() ? `<p style="margin:0 0 12px;line-height:1.6;">${line}</p>` : "<br/>"
        ).join("")}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="font-size:12px;color:#999;">Sent via Vantio · ${senderName}</p>
      </div>`,
      text: body.body,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log the sent email to Supabase
    await supabase.from("outreach_emails").insert({
      user_id: user.id,
      lead_id: body.lead_id ?? null,
      run_id: body.run_id ?? null,
      company_name: body.company_name ?? null,
      recipient_email: body.to,
      subject: body.subject,
      body: body.body,
      sender_name: senderName,
      sent_at: new Date().toISOString(),
    }).select().maybeSingle(); // Non-blocking — table may not exist yet, that's fine

    return NextResponse.json({ ok: true, message: "Email sent successfully" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}