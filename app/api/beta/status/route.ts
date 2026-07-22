// app/api/beta/status/route.ts
// Lightweight check for client components: does the current user have
// active private-beta membership? Used to hide subscription/pricing UI
// during beta, per the "hide subscriptions entirely during the test
// period" requirement. Also exposes the reason when inactive (never a
// beta tester vs. expired vs. revoked) and discount status, so the
// completion page and settings UI can show the right state.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaAccess, getBetaMembership } from "@/lib/beta/access";
import { getDiscountGrant } from "@/lib/beta/completion";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ active: false, reason: "no_membership" });

  const access = await getBetaAccess(user.id);
  if (!access.active) {
    // Was this user ever a beta tester? If expired, surface discount status.
    let discount = null;
    if (access.reason === "expired") {
      const membership = await getBetaMembership(user.id);
      if (membership) discount = await getDiscountGrant(membership.id);
    }
    return NextResponse.json({ active: false, reason: access.reason, discount });
  }

  return NextResponse.json({
    active: true,
    daysRemainingActive: access.daysRemainingActive,
    daysRemainingCalendar: access.daysRemainingCalendar,
  });
}
