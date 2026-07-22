// lib/beta/adminOverview.ts
// Aggregates everything the admin dashboard needs to show for one tester.
// Deliberately a read-heavy, denormalized view assembled at request time
// rather than a materialized table — this is a handful of testers, not a
// scale concern.

import { getBetaServiceClient } from "./serviceClient";
import { countEvents } from "@/lib/analytics/log";

export type TesterOverview = {
  membershipId: string;
  userId: string;
  userEmail: string | null;
  invitationStatus: string | null;
  invitationEmail: string | null;
  companyName: string | null;
  membershipStatus: string;
  activatedAt: string;
  activeDaysUsed: number;
  hardEndAt: string;
  extendedDays: number;
  extensionGrantedBy: string | null;
  extensionGrantedAt: string | null;
  searchesCompleted: number;
  deepSearchesCompleted: number;
  leadDetailViews: number;
  aiUsage: Record<string, { count: number; costMicroUsd: number }>;
  outcomes: { contacted: number; replied: number; bookedCall: number; closed: number };
  featureRatings: { featureKey: string; rating: number | null; notUsedEnough: boolean; freeText: string | null }[];
  finalInterviewCompleted: boolean;
  requiredFeedbackCompleted: boolean;
  testimonialStatus: string | null;
  discountStatus: string | null;
  discountPercent: number | null;
  internalNotes: string | null;
  monetaryCeilingMicroUsd: number | null;
  allowanceOverrides: { feature: string; dailyLimit: number | null; totalLimit: number | null }[];
};

export async function getTesterOverview(membershipId: string): Promise<TesterOverview | null> {
  const client = await getBetaServiceClient();
  if (!client) return null;

  const { data: membership } = await client.from("beta_memberships").select("*").eq("id", membershipId).maybeSingle();
  if (!membership) return null;

  const [
    { data: invitation },
    { data: authUser },
    { data: usageRows },
    { data: outcomeRows },
    { data: featureFeedbackRows },
    { data: testimonial },
    { data: discount },
    { data: allowances },
    leadDetailViews,
    searchesCompleted,
    deepSearchesCompleted,
  ] = await Promise.all([
    client
      .from("beta_invitations")
      .select("status, email, company_name")
      .eq("id", membership.invitation_id)
      .maybeSingle(),
    client.auth.admin
      .getUserById(membership.user_id)
      .then((r) => ({ data: r.data.user }))
      .catch(() => ({ data: null })),
    client
      .from("beta_usage")
      .select("feature, cost_micro_usd, status")
      .eq("membership_id", membershipId)
      .in("status", ["reserved", "committed"]),
    client.from("lead_outcomes").select("contacted, replied, booked_call, closed").eq("user_id", membership.user_id),
    client
      .from("beta_feature_feedback")
      .select("feature_key, rating, not_used_enough, free_text")
      .eq("membership_id", membershipId),
    client.from("beta_testimonials").select("status").eq("membership_id", membershipId).maybeSingle(),
    client.from("beta_discount_grants").select("status, percent").eq("membership_id", membershipId).maybeSingle(),
    client
      .from("beta_feature_allowances")
      .select("feature, daily_limit, total_limit")
      .eq("membership_id", membershipId),
    countEvents(membership.user_id, "lead_detail_viewed"),
    countEvents(membership.user_id, "search_completed"),
    countEvents(membership.user_id, "deep_search_completed"),
  ]);

  const aiUsage: Record<string, { count: number; costMicroUsd: number }> = {};
  for (const row of usageRows ?? []) {
    if (!aiUsage[row.feature]) aiUsage[row.feature] = { count: 0, costMicroUsd: 0 };
    aiUsage[row.feature].count += 1;
    aiUsage[row.feature].costMicroUsd += row.cost_micro_usd ?? 0;
  }

  const outcomes = (outcomeRows ?? []).reduce(
    (acc, row) => ({
      contacted: acc.contacted + (row.contacted ? 1 : 0),
      replied: acc.replied + (row.replied ? 1 : 0),
      bookedCall: acc.bookedCall + (row.booked_call ? 1 : 0),
      closed: acc.closed + (row.closed ? 1 : 0),
    }),
    { contacted: 0, replied: 0, bookedCall: 0, closed: 0 },
  );

  return {
    membershipId: membership.id,
    userId: membership.user_id,
    userEmail: authUser?.email ?? null,
    invitationStatus: invitation?.status ?? null,
    invitationEmail: invitation?.email ?? null,
    companyName: invitation?.company_name ?? null,
    membershipStatus: membership.status,
    activatedAt: membership.activated_at,
    activeDaysUsed: membership.active_days_used,
    hardEndAt: membership.hard_end_at,
    extendedDays: membership.extended_days,
    extensionGrantedBy: membership.extension_granted_by,
    extensionGrantedAt: membership.extension_granted_at,
    searchesCompleted,
    deepSearchesCompleted,
    leadDetailViews,
    aiUsage,
    outcomes,
    featureRatings: (featureFeedbackRows ?? []).map((r) => ({
      featureKey: r.feature_key,
      rating: r.rating,
      notUsedEnough: r.not_used_enough,
      freeText: r.free_text,
    })),
    finalInterviewCompleted: membership.final_interview_completed,
    requiredFeedbackCompleted: membership.required_feedback_completed,
    testimonialStatus: testimonial?.status ?? null,
    discountStatus: discount?.status ?? null,
    discountPercent: discount?.percent ?? null,
    internalNotes: membership.internal_notes,
    monetaryCeilingMicroUsd: membership.monetary_ceiling_micro_usd,
    allowanceOverrides: (allowances ?? []).map((a) => ({
      feature: a.feature,
      dailyLimit: a.daily_limit,
      totalLimit: a.total_limit,
    })),
  };
}

export async function getAllTesterOverviews(): Promise<TesterOverview[]> {
  const client = await getBetaServiceClient();
  if (!client) return [];

  const { data: memberships } = await client
    .from("beta_memberships")
    .select("id")
    .order("created_at", { ascending: false });
  if (!memberships) return [];

  const overviews = await Promise.all(memberships.map((m) => getTesterOverview(m.id)));
  return overviews.filter((o): o is TesterOverview => o !== null);
}
