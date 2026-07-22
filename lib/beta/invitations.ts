// lib/beta/invitations.ts
// Invitation token generation/hashing and lifecycle. Only a secure hash of
// the usable token is ever stored — the raw token exists only in memory
// long enough to build the invite URL, and in the email/message sent to
// the tester.

import crypto from "crypto";
import { getBetaServiceClient } from "./serviceClient";
import { BETA_INVITATION_EXPIRY_DAYS } from "./config";
import { logEvent } from "@/lib/analytics/log";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export type CreateInvitationResult = { ok: true; inviteUrl: string; expiresAt: string } | { ok: false; error: string };

export async function createBetaInvitation(
  email: string,
  createdBy: string,
  baseUrl: string,
  companyName?: string,
): Promise<CreateInvitationResult> {
  const client = await getBetaServiceClient();
  if (!client) return { ok: false, error: "Service not configured" };

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + BETA_INVITATION_EXPIRY_DAYS * 86_400_000);

  const { error } = await client.from("beta_invitations").insert({
    email: email.trim().toLowerCase(),
    company_name: companyName?.trim() || null,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    created_by: createdBy,
  });

  if (error) return { ok: false, error: error.message };

  await logEvent(null, "beta_invite_created", { invitedEmail: email });

  return {
    ok: true,
    inviteUrl: `${baseUrl}/beta/invite/${rawToken}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export type InviteValidation =
  | { valid: true; email: string }
  | { valid: false; reason: "not_found" | "expired" | "revoked" | "accepted" };

// Server-side only — looks up the invitation by the hash of the raw token
// from the URL. Never exposes the invitation's id or hash to the caller.
export async function validateInviteToken(rawToken: string): Promise<InviteValidation> {
  const client = await getBetaServiceClient();
  if (!client) return { valid: false, reason: "not_found" };

  const tokenHash = hashToken(rawToken);
  const { data, error } = await client
    .from("beta_invitations")
    .select("email, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return { valid: false, reason: "not_found" };

  if (data.status === "revoked") return { valid: false, reason: "revoked" };
  if (data.status === "accepted") return { valid: false, reason: "accepted" };
  if (new Date(data.expires_at) < new Date()) return { valid: false, reason: "expired" };

  await logEvent(null, "beta_invite_opened", { invitedEmail: data.email });

  return { valid: true, email: data.email as string };
}

export type AcceptInvitationReason =
  | "not_found"
  | "revoked"
  | "already_accepted"
  | "expired"
  | "email_mismatch"
  | "already_has_membership";

export type AcceptInvitationResult =
  | { success: true; membershipId: string }
  | { success: false; reason: AcceptInvitationReason };

export async function acceptBetaInvitation(
  rawToken: string,
  userId: string,
  userEmail: string,
): Promise<AcceptInvitationResult> {
  const client = await getBetaServiceClient();
  if (!client) return { success: false, reason: "not_found" };

  const tokenHash = hashToken(rawToken);
  const { data, error } = await client
    .rpc("accept_beta_invitation", {
      p_token_hash: tokenHash,
      p_user_id: userId,
      p_user_email: userEmail,
    })
    .single();

  if (error || !data) return { success: false, reason: "not_found" };

  const row = data as { success: boolean; reason: AcceptInvitationReason; membership_id: string | null };
  if (row.success && row.membership_id) {
    await logEvent(userId, "beta_invite_accepted", {});
    await logEvent(userId, "beta_membership_started", { membershipId: row.membership_id });
    return { success: true, membershipId: row.membership_id };
  }
  return { success: false, reason: row.reason };
}

export type InvitationListItem = {
  id: string;
  email: string;
  companyName: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export async function getAllInvitations(): Promise<InvitationListItem[]> {
  const client = await getBetaServiceClient();
  if (!client) return [];
  const { data } = await client
    .from("beta_invitations")
    .select("id, email, company_name, status, created_at, expires_at, accepted_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    companyName: r.company_name,
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
  }));
}

export async function adminRevokeInvitation(invitationId: string, adminEmail: string): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.from("beta_invitations").update({ status: "revoked" }).eq("id", invitationId).eq("status", "pending"); // only revoke while still unaccepted
  const { logAdminAction } = await import("@/lib/analytics/log");
  await logAdminAction(adminEmail, "revoke_invitation", invitationId);
}
