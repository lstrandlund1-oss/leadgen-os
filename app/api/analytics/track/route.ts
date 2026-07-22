// app/api/analytics/track/route.ts
// For the rare client-side-only signal that has no natural server-side
// logging point. Allowlisted event names only — this is not a general
// "log anything" endpoint.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { logEvent } from "@/lib/analytics/log";

const ALLOWED_CLIENT_EVENTS = new Set(["profile_started"]);

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ ok: true }); // silently no-op, not worth erroring the client over

  let body: { event?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (body.event && ALLOWED_CLIENT_EVENTS.has(body.event)) {
    await logEvent(user.id, body.event, {});
  }

  return NextResponse.json({ ok: true });
}
