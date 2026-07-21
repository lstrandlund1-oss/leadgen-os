// app/api/beta/accept/route.ts
// Accepts a private-beta invitation for the currently authenticated user.
// The invite page's embedded auth form calls this immediately after
// establishing a session. Server re-validates everything — the token,
// email match, and duplicate-membership check all happen atomically inside
// accept_beta_invitation(), never trusting anything from the client beyond
// the token itself.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { acceptBetaInvitation } from "@/lib/beta/invitations";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = body.token;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const result = await acceptBetaInvitation(token, user.id, user.email);

  if (!result.success) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  return NextResponse.json({ success: true, membershipId: result.membershipId });
}
