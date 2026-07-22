// app/api/beta/feedback/lead/route.ts
// Lead-specific accuracy feedback ("was this score accurate for this
// lead?"), deliberately separate from feature-level ratings per spec.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaAccess } from "@/lib/beta/access";
import { submitLeadFeedback } from "@/lib/beta/feedback";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const access = await getBetaAccess(user.id);
  if (!access.active) return NextResponse.json({ error: "No active beta membership" }, { status: 403 });

  let body: { leadId?: string; runId?: number | null; accurate?: boolean | null; comment?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  await submitLeadFeedback(
    access.membership.id,
    user.id,
    body.leadId,
    body.runId ?? null,
    body.accurate ?? null,
    body.comment?.trim() || null,
  );

  return NextResponse.json({ ok: true });
}
