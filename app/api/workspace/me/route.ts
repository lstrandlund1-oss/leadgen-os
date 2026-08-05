// app/api/workspace/me/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getServiceClient } from "@/lib/supabaseServiceClient";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await getServiceClient();
  if (!client) return NextResponse.json({ workspace: null });

  const { data: membership } = await client
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (!membership) return NextResponse.json({ workspace: null });

  const { data: workspace } = await client
    .from("workspaces")
    .select("name")
    .eq("id", membership.workspace_id)
    .maybeSingle();

  return NextResponse.json({
    workspace: workspace ? { name: workspace.name, role: membership.role } : null,
  });
}
