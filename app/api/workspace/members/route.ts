// app/api/workspace/members/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getWorkspaceForUser, listWorkspaceMembers, listPendingInvitations } from "@/lib/workspace/members";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getWorkspaceForUser(authUser.id);
  if (!workspace) {
    return NextResponse.json({ workspace: null, members: [], invitations: [] });
  }

  const [members, invitations] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    listPendingInvitations(workspace.id),
  ]);

  return NextResponse.json({ workspace, members, invitations });
}
