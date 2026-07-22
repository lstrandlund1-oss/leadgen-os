// app/api/admin/beta/actions/route.ts
// Single dispatch endpoint for all admin mutations on a tester's beta
// membership. Every action is authorized here (admin allowlist) and
// audited (lib/beta/completion.ts's functions all call logAdminAction).

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/beta/adminAuth";
import {
  adminExpireMembership,
  adminRevokeMembership,
  adminGrantExtension,
  adminMarkInterviewCompleted,
  adminMarkRequiredFeedbackCompleted,
  adminSetInternalNotes,
  adminSetAllowanceOverride,
  adminSetMonetaryCeiling,
  adminAwardDiscountManually,
} from "@/lib/beta/completion";
import { adminRevokeInvitation } from "@/lib/beta/invitations";
import type { BetaFeature } from "@/lib/beta/types";

type ActionBody = {
  action: string;
  membershipId?: string;
  userId?: string;
  invitationId?: string;
  days?: number;
  notes?: string;
  feature?: BetaFeature;
  dailyLimit?: number | null;
  totalLimit?: number | null;
  ceilingMicroUsd?: number | null;
};

export async function POST(request: Request) {
  const { isAdmin, email: adminEmail } = await isAdminRequest();
  if (!isAdmin || !adminEmail) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  let body: ActionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action, membershipId, userId } = body;
  if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });

  switch (action) {
    case "expire_membership":
      if (!membershipId) return NextResponse.json({ error: "membershipId required" }, { status: 400 });
      await adminExpireMembership(membershipId, adminEmail);
      break;

    case "revoke_membership":
      if (!membershipId) return NextResponse.json({ error: "membershipId required" }, { status: 400 });
      await adminRevokeMembership(membershipId, adminEmail);
      break;

    case "grant_extension":
      if (!membershipId || !body.days)
        return NextResponse.json({ error: "membershipId and days required" }, { status: 400 });
      await adminGrantExtension(membershipId, adminEmail, body.days);
      break;

    case "mark_interview_completed":
      if (!membershipId || !userId)
        return NextResponse.json({ error: "membershipId and userId required" }, { status: 400 });
      await adminMarkInterviewCompleted(membershipId, userId, adminEmail);
      break;

    case "mark_required_feedback_completed":
      if (!membershipId || !userId)
        return NextResponse.json({ error: "membershipId and userId required" }, { status: 400 });
      await adminMarkRequiredFeedbackCompleted(membershipId, userId, adminEmail);
      break;

    case "set_internal_notes":
      if (!membershipId || body.notes === undefined)
        return NextResponse.json({ error: "membershipId and notes required" }, { status: 400 });
      await adminSetInternalNotes(membershipId, body.notes, adminEmail);
      break;

    case "set_allowance_override":
      if (!membershipId || !body.feature)
        return NextResponse.json({ error: "membershipId and feature required" }, { status: 400 });
      await adminSetAllowanceOverride(
        membershipId,
        body.feature,
        body.dailyLimit ?? null,
        body.totalLimit ?? null,
        adminEmail,
      );
      break;

    case "set_monetary_ceiling":
      if (!membershipId) return NextResponse.json({ error: "membershipId required" }, { status: 400 });
      await adminSetMonetaryCeiling(membershipId, body.ceilingMicroUsd ?? null, adminEmail);
      break;

    case "award_discount_manually":
      if (!membershipId || !userId)
        return NextResponse.json({ error: "membershipId and userId required" }, { status: 400 });
      await adminAwardDiscountManually(membershipId, userId, adminEmail);
      break;

    case "revoke_invitation":
      if (!body.invitationId) return NextResponse.json({ error: "invitationId required" }, { status: 400 });
      await adminRevokeInvitation(body.invitationId, adminEmail);
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
