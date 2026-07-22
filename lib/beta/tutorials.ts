// lib/beta/tutorials.ts
// Tutorial progress persistence. Low-stakes, single-user-acting-on-their-
// own-data operations — a plain select-then-insert-or-update is sufficient
// here, unlike beta_usage's atomic reserve/commit/release which guards
// against real concurrent-request races.

import { getBetaServiceClient } from "./serviceClient";
import { logEvent } from "@/lib/analytics/log";
import type { TutorialKey } from "./tutorialDefinitions";
import type { BetaTutorialProgress } from "./types";

type ProgressRow = {
  id: number;
  membership_id: string;
  user_id: string;
  tutorial_key: string;
  tutorial_version: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
  skipped_at: string | null;
  replay_count: number;
  updated_at: string;
};

function mapRow(row: ProgressRow): BetaTutorialProgress {
  return {
    id: row.id,
    membershipId: row.membership_id,
    userId: row.user_id,
    tutorialKey: row.tutorial_key,
    tutorialVersion: row.tutorial_version,
    currentStep: row.current_step,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    skippedAt: row.skipped_at,
    replayCount: row.replay_count,
    updatedAt: row.updated_at,
  };
}

// Fetch every tutorial's progress for this membership in one call — the
// client uses this to decide which tutorials (at their current version)
// haven't been seen yet, without a round trip per page.
export async function getAllTutorialProgress(membershipId: string): Promise<Record<string, BetaTutorialProgress>> {
  const client = await getBetaServiceClient();
  if (!client) return {};

  const { data, error } = await client.from("beta_tutorial_progress").select("*").eq("membership_id", membershipId);

  if (error || !data) return {};

  const result: Record<string, BetaTutorialProgress> = {};
  for (const row of data as ProgressRow[]) {
    // Keyed by "key:version" so a version bump naturally shows as unseen
    // without needing to touch old rows.
    result[`${row.tutorial_key}:${row.tutorial_version}`] = mapRow(row);
  }
  return result;
}

async function upsertProgress(
  membershipId: string,
  userId: string,
  key: TutorialKey,
  version: string,
  patch: Partial<{ current_step: number; completed_at: string | null; skipped_at: string | null }>,
  isReplay: boolean = false,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;

  const { data: existing } = await client
    .from("beta_tutorial_progress")
    .select("id, replay_count")
    .eq("membership_id", membershipId)
    .eq("tutorial_key", key)
    .eq("tutorial_version", version)
    .maybeSingle();

  if (!existing) {
    await client.from("beta_tutorial_progress").insert({
      membership_id: membershipId,
      user_id: userId,
      tutorial_key: key,
      tutorial_version: version,
      ...patch,
    });
    return;
  }

  await client
    .from("beta_tutorial_progress")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
      ...(isReplay ? { replay_count: (existing.replay_count ?? 0) + 1 } : {}),
    })
    .eq("id", existing.id);
}

// Call once, right when a tutorial is actually shown to the user (not
// just eligible) — ensures the row exists and logs the distinct
// tutorial_started event per the spec's stable event taxonomy.
export async function startTutorial(
  membershipId: string,
  userId: string,
  key: TutorialKey,
  version: string,
): Promise<void> {
  const client = await getBetaServiceClient();
  if (!client) return;
  const { data: existing } = await client
    .from("beta_tutorial_progress")
    .select("id")
    .eq("membership_id", membershipId)
    .eq("tutorial_key", key)
    .eq("tutorial_version", version)
    .maybeSingle();
  if (!existing) {
    await client.from("beta_tutorial_progress").insert({
      membership_id: membershipId,
      user_id: userId,
      tutorial_key: key,
      tutorial_version: version,
      current_step: 0,
    });
  }
  await logEvent(userId, "tutorial_started", { tutorialKey: key });
}

// Call after each step is shown — persists progress incrementally so
// navigating away mid-tutorial doesn't lose the tester's place.
export async function recordTutorialStep(
  membershipId: string,
  userId: string,
  key: TutorialKey,
  version: string,
  step: number,
): Promise<void> {
  await upsertProgress(membershipId, userId, key, version, { current_step: step });
}

export async function completeTutorial(
  membershipId: string,
  userId: string,
  key: TutorialKey,
  version: string,
): Promise<void> {
  await upsertProgress(membershipId, userId, key, version, { completed_at: new Date().toISOString() });
  await logEvent(userId, "tutorial_completed", { tutorialKey: key });
}

export async function skipTutorial(
  membershipId: string,
  userId: string,
  key: TutorialKey,
  version: string,
): Promise<void> {
  await upsertProgress(membershipId, userId, key, version, { skipped_at: new Date().toISOString() });
  await logEvent(userId, "tutorial_skipped", { tutorialKey: key });
}

// Voluntary re-watch from Settings → Tutorials. Resets the seen state so
// it shows again, and increments replay_count for the admin dashboard's
// visibility into engagement.
export async function replayTutorial(
  membershipId: string,
  userId: string,
  key: TutorialKey,
  version: string,
): Promise<void> {
  await upsertProgress(
    membershipId,
    userId,
    key,
    version,
    { current_step: 0, completed_at: null, skipped_at: null },
    true,
  );
  await logEvent(userId, "tutorial_replayed", { tutorialKey: key });
}
