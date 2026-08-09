import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaAccess } from "@/lib/beta/access";
import { getDiscountGrant } from "@/lib/beta/completion";
import { getAllowanceOverride, getBetaUsageCounts } from "@/lib/beta/usage";
import { BETA_DEFAULT_ALLOWANCES } from "@/lib/beta/config";
import type { BetaFeature } from "@/lib/beta/types";

const FEATURES: BetaFeature[] = ["outreach", "followup", "ai_deep_search"];

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getBetaAccess(user.id);

  if (!access.active) {
    // Not an active beta tester — no real usage/allowance data applies.
    // Surface discount status if this user completed a beta previously,
    // same as the beta status route does.
    return NextResponse.json({ active: false, reason: access.reason, discount: null, usage: [] });
  }

  const { membership, daysRemainingActive, daysRemainingCalendar } = access;

  const usage = await Promise.all(
    FEATURES.map(async (feature) => {
      const override = await getAllowanceOverride(membership.id, feature);
      const allowance = override ?? BETA_DEFAULT_ALLOWANCES[feature];
      const counts = await getBetaUsageCounts(membership.id, feature, membership.timezone);
      return {
        feature,
        dailyLimit: allowance.daily,
        totalLimit: allowance.total,
        usedToday: counts.usedToday,
        usedTotal: counts.usedTotal,
      };
    }),
  );

  const discount = await getDiscountGrant(membership.id);

  return NextResponse.json({
    active: true,
    daysRemainingActive,
    daysRemainingCalendar,
    activatedAt: membership.activatedAt,
    hardEndAt: membership.hardEndAt,
    usage,
    discount,
  });
}
