// app/api/beta/feedback/route.ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaAccess } from "@/lib/beta/access";
import { getEligibleFeedbackFeature, submitFeatureFeedback, getRatedFeatures } from "@/lib/beta/feedback";
import type { FeedbackFeatureKey } from "@/lib/beta/feedbackTriggers";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ active: false, eligibleFeature: null, rated: [] });

  const access = await getBetaAccess(user.id);
  if (!access.active) return NextResponse.json({ active: false, eligibleFeature: null, rated: [] });

  const [eligibleFeature, rated] = await Promise.all([
    getEligibleFeedbackFeature(user.id, access.membership.id),
    getRatedFeatures(access.membership.id),
  ]);

  return NextResponse.json({ active: true, eligibleFeature, rated: Array.from(rated) });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const access = await getBetaAccess(user.id);
  if (!access.active) return NextResponse.json({ error: "No active beta membership" }, { status: 403 });

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

  await submitFeatureFeedback(access.membership.id, user.id, body.featureKey, {
    rating: body.notUsedEnough ? null : (body.rating ?? null),
    notUsedEnough: body.notUsedEnough ?? false,
    reasonKey: body.reasonKey ?? null,
    freeText: body.freeText?.trim() || null,
  });

  return NextResponse.json({ ok: true });
}
