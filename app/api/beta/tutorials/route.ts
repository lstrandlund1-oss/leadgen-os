// app/api/beta/tutorials/route.ts
// Tutorial progress for the current user's beta membership. Tutorials are
// a beta-specific feature (tied to beta_memberships), so both endpoints
// are no-ops for non-beta users.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaMembership } from "@/lib/beta/access";
import {
  getAllTutorialProgress,
  recordTutorialStep,
  completeTutorial,
  skipTutorial,
  replayTutorial,
} from "@/lib/beta/tutorials";
import { TUTORIAL_DEFINITIONS, type TutorialKey } from "@/lib/beta/tutorialDefinitions";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ active: false, progress: {}, definitions: TUTORIAL_DEFINITIONS });

  // Tutorial history is preserved and remains readable/replayable after
  // expiration (it costs nothing and requires no active entitlement) — only
  // a user who was never a beta member at all gets nothing here.
  const membership = await getBetaMembership(user.id);
  if (!membership) return NextResponse.json({ active: false, progress: {}, definitions: TUTORIAL_DEFINITIONS });

  const progress = await getAllTutorialProgress(membership.id);
  return NextResponse.json({ active: true, progress, definitions: TUTORIAL_DEFINITIONS });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Tutorial actions cost nothing and require no active entitlement, so
  // expired members can still replay/interact with them — only someone who
  // was never a beta member at all is blocked here.
  const membership = await getBetaMembership(user.id);
  if (!membership) return NextResponse.json({ error: "No beta membership" }, { status: 403 });

  let body: { key?: TutorialKey; action?: "step" | "complete" | "skip" | "replay"; step?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { key, action, step } = body;
  if (!key || !(key in TUTORIAL_DEFINITIONS) || !action) {
    return NextResponse.json({ error: "key and action required" }, { status: 400 });
  }

  const version = TUTORIAL_DEFINITIONS[key].version;
  const membershipId = membership.id;

  switch (action) {
    case "step":
      await recordTutorialStep(membershipId, user.id, key, version, step ?? 0);
      break;
    case "complete":
      await completeTutorial(membershipId, user.id, key, version);
      break;
    case "skip":
      await skipTutorial(membershipId, user.id, key, version);
      break;
    case "replay":
      await replayTutorial(membershipId, user.id, key, version);
      break;
  }

  return NextResponse.json({ ok: true });
}
