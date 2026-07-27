// app/api/admin/platform-settings/route.ts
// Platform-wide settings (currently just the AI generation kill switch).
// Not beta-specific, but reuses the same admin allowlist auth.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/beta/adminAuth";
import { getServiceClient } from "@/lib/supabaseServiceClient";

export async function GET() {
  const { isAdmin } = await isAdminRequest();
  if (!isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const client = await getServiceClient();
  if (!client) return NextResponse.json({ settings: [] });

  const { data } = await client.from("platform_settings").select("*").order("key");
  return NextResponse.json({ settings: data ?? [] });
}

export async function POST(request: Request) {
  const { isAdmin, email: adminEmail } = await isAdminRequest();
  if (!isAdmin || !adminEmail) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: { key?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.key || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "key and enabled required" }, { status: 400 });
  }

  const client = await getServiceClient();
  if (!client) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const { error } = await client
    .from("platform_settings")
    .update({ enabled: body.enabled, updated_by: adminEmail, updated_at: new Date().toISOString() })
    .eq("key", body.key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
