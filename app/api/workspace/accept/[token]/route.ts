// app/api/workspace/accept/[token]/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { acceptInvitation } from "@/lib/workspace/members";

export async function POST(_request: Request, { params }: { params: { token: string } | Promise<{ token: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const result = await acceptInvitation(resolvedParams.token, authUser.id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Failed to accept invitation" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
