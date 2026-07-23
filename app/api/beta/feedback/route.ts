// app/api/beta/feedback/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaMembership } from "@/lib/beta/access";
import {
  getEligibleFeedbackFeature,
  submitFeatureFeedback,
  getRatedFeatures,
  resolveFeedbackRating,
} from "@/lib/beta/feedback";
import type { FeedbackFeatureKey } from "@/lib/beta/feedbackTriggers";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ active: false, eligibleFeature: null, rated: [] });

  const membership = await getBetaMembership(user.id);
  if (!membership) return NextResponse.json({ active: false, eligibleFeature: null, rated: [] });

  // Automatic-prompt eligibility only makes sense for active members (an
  // expired member incurs no further triggering actions), but rating
  // history itself is preserved and stays readable regardless.
  const [eligibleFeature, rated] = await Promise.all([
    getEligibleFeedbackFeature(user.id, membership.id),
    getRatedFeatures(membership.id),
  ]);

  return NextResponse.json({ active: true, eligibleFeature, rated: Array.from(rated) });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Voluntary re-rating costs nothing and requires no active entitlement,
  // so this remains available after expiration too.
  const membership = await getBetaMembership(user.id);
  if (!membership) return NextResponse.json({ error: "No beta membership" }, { status: 403 });

  let body: {
    featureKey?: FeedbackFeatureKey;
    rating?: number | null;
    notUsedEnough?: boolean;
    reasonKey?: string | null;
    freeText?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.featureKey) return NextResponse.json({ error: "featureKey required" }, { status: 400 });
  if (!body.notUsedEnough && (body.rating === undefined || body.rating === null)) {
    return NextResponse.json({ error: "rating required unless notUsedEnough" }, { status: 400 });
  }

  await submitFeatureFeedback(membership.id, user.id, body.featureKey, {
    rating: resolveFeedbackRating(body.notUsedEnough ?? false, body.rating),
    notUsedEnough: body.notUsedEnough ?? false,
    reasonKey: body.reasonKey ?? null,
    freeText: body.freeText?.trim() || null,
  });

  return NextResponse.json({ ok: true });
}
