// app/api/workspace/invite/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWorkspaceForUser, createInvitation } from "@/lib/workspace/members";

export async function POST(request: Request) {
  const authUser = await getAuthUser();
  if (!authUser?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const workspace = await getWorkspaceForUser(authUser.id);
  if (!workspace) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.vantioapp.com";
  const result = await createInvitation(workspace.id, workspace.name, authUser.email, authUser.id, email, baseUrl);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to send invitation" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
