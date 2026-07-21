// app/api/admin/beta/invite/route.ts
// Admin-only: create a private-beta invitation for one email. Returns the
// raw invite URL exactly once — it is never retrievable again after this
// response, since only its hash is stored.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/beta/adminAuth";
import { createBetaInvitation } from "@/lib/beta/invitations";

export async function POST(request: Request) {
  const { isAdmin, email: adminEmail } = await isAdminRequest();
  if (!isAdmin) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
  const result = await createBetaInvitation(email, adminEmail ?? "unknown", baseUrl);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ inviteUrl: result.inviteUrl, expiresAt: result.expiresAt });
}
