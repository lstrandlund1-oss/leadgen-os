// app/api/beta/status/route.ts
// Lightweight check for client components: does the current user have
// active private-beta membership? Used to hide subscription/pricing UI
// during beta, per the "hide subscriptions entirely during the test
// period" requirement.

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabaseServer";
import { getBetaAccess } from "@/lib/beta/access";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ active: false });

  const access = await getBetaAccess(user.id);
  if (!access.active) return NextResponse.json({ active: false });

  return NextResponse.json({
    active: true,
    daysRemainingActive: access.daysRemainingActive,
    daysRemainingCalendar: access.daysRemainingCalendar,
  });
}
