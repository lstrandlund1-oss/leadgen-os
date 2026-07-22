// lib/analytics/log.ts
// Minimal event logging against the analytics_events table (created in
// Phase 1). Deliberately generic — not beta-specific — since this becomes
// the foundation for Phase 9's full analytics system too. Right now it's
// used to count qualifying actions for Phase 6's feedback triggers.

import { getBetaServiceClient } from "@/lib/beta/serviceClient";

export async function logEvent(
  userId: string,
  eventName: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.from("analytics_events").insert({ user_id: userId, event_name: eventName, properties });
}

// Count how many times this user has logged a given event, ever. Used for
// threshold-based triggers like "two completed searches".
export async function countEvents(userId: string, eventName: string): Promise<number> {
  const client = await getBetaServiceClient();
  if (!client) return 0;
  const { count } = await client
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_name", eventName);
  return count ?? 0;
}

// Every sensitive admin mutation must be auditable (who did what, when).
// Reuses the same event log rather than a dedicated audit table.
export async function logAdminAction(
  adminEmail: string,
  action: string,
  membershipId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  await client.from("analytics_events").insert({
    user_id: null,
    event_name: "admin_action",
    properties: { action, membershipId, adminEmail, details, at: new Date().toISOString() },
  });
}
