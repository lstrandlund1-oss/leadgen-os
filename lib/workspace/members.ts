// lib/workspace/members.ts
//
// Workspace member listing and invitation flow. Member emails are
// resolved via the Supabase admin API (auth.admin.getUserById) since
// workspace_members only stores user_id — email lives in Supabase's own
// auth schema, not duplicated into application tables.

import { getServiceClient } from "@/lib/supabaseServiceClient";
import { sendWorkspaceInvite } from "@/lib/email/send";

export type WorkspaceMemberWithEmail = {
  userId: string;
  email: string | null;
  role: string;
  joinedAt: string;
};

export type PendingInvitation = {
  id: string;
  invitedEmail: string;
  status: string;
  createdAt: string;
};

export async function getWorkspaceForUser(userId: string): Promise<{ id: string; name: string } | null> {
  const client = await getServiceClient();
  if (!client) return null;

  const { data: membership } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;

  const { data: workspace } = await client
    .from("workspaces")
    .select("id, name")
    .eq("id", membership.workspace_id)
    .maybeSingle();
  return workspace ? { id: workspace.id, name: workspace.name } : null;
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberWithEmail[]> {
  const client = await getServiceClient();
  if (!client) return [];

  const { data: members } = await client
    .from("workspace_members")
    .select("user_id, role, joined_at")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  if (!members) return [];

  const withEmails = await Promise.all(
    members.map(async (m) => {
      const { data } = await client.auth.admin.getUserById(m.user_id as string);
      return {
        userId: m.user_id as string,
        email: data.user?.email ?? null,
        role: m.role as string,
        joinedAt: m.joined_at as string,
      };
    }),
  );

  return withEmails;
}

export async function listPendingInvitations(workspaceId: string): Promise<PendingInvitation[]> {
  const client = await getServiceClient();
  if (!client) return [];

  const { data } = await client
    .from("workspace_invitations")
    .select("id, invited_email, status, created_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (data ?? []).map((i) => ({
    id: i.id as string,
    invitedEmail: i.invited_email as string,
    status: i.status as string,
    createdAt: i.created_at as string,
  }));
}

export async function createInvitation(
  workspaceId: string,
  workspaceName: string,
  invitedByEmail: string,
  invitedByUserId: string,
  invitedEmail: string,
  baseUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = await getServiceClient();
  if (!client) return { ok: false, error: "Not configured" };

  const { data: invitation, error } = await client
    .from("workspace_invitations")
    .insert({ workspace_id: workspaceId, invited_email: invitedEmail, invited_by: invitedByUserId })
    .select("token")
    .single();

  if (error || !invitation) {
    return { ok: false, error: error?.message ?? "Failed to create invitation" };
  }

  const acceptUrl = `${baseUrl}/workspace/accept/${invitation.token}`;
  const emailResult = await sendWorkspaceInvite({
    to: invitedEmail,
    workspaceName,
    invitedByEmail,
    acceptUrl,
  });

  if (!emailResult.ok) {
    return { ok: false, error: emailResult.error };
  }

  return { ok: true };
}

export async function acceptInvitation(
  token: string,
  acceptingUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = await getServiceClient();
  if (!client) return { ok: false, error: "Not configured" };

  const { data: invitation } = await client
    .from("workspace_invitations")
    .select("id, workspace_id, status")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) return { ok: false, error: "Invitation not found" };
  if (invitation.status !== "pending") return { ok: false, error: "Invitation already used or revoked" };

  const { error: memberError } = await client
    .from("workspace_members")
    .upsert(
      { workspace_id: invitation.workspace_id, user_id: acceptingUserId, role: "member" },
      { onConflict: "workspace_id,user_id" },
    );
  if (memberError) return { ok: false, error: memberError.message };

  await client
    .from("workspace_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return { ok: true };
}
