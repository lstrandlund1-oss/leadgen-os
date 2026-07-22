"use client";

import { useEffect, useState } from "react";

type TesterOverview = {
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

type InvitationItem = {
  id: string;
  email: string;
  companyName: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
};

function microUsd(n: number): string {
  return `$${(n / 1_000_000).toFixed(3)}`;
}

async function callAction(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/admin/beta/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return res.ok;
}

export default function AdminBetaDashboard() {
  const [testers, setTesters] = useState<TesterOverview[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/beta/testers");
      if (res.ok) {
        const data = await res.json();
        setTesters(data.testers ?? []);
        setInvitations(data.invitations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createInvitation() {
    if (!newEmail.trim()) return;
    const res = await fetch("/api/admin/beta/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim(), companyName: newCompany.trim() || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setLastInviteUrl(data.inviteUrl);
      setNewEmail("");
      setNewCompany("");
      refresh();
    } else {
      alert(data.error ?? "Failed to create invitation");
    }
  }

  async function runAction(action: string, payload: Record<string, unknown>) {
    const ok = await callAction(action, payload);
    if (ok) refresh();
    else alert("Action failed");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex items-center justify-center">
        <p className="text-sm text-[#555]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] px-6 py-10 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8" style={{ fontFamily: "var(--font-display), serif" }}>
        Private Beta — Admin
      </h1>

      {/* Create invitation */}
      <section className="rounded-2xl border border-[#252525] bg-[#111] p-5 mb-8">
        <h2 className="text-[13px] font-semibold text-[#c8c0b0] mb-3">Create invitation</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@company.com"
            className="flex-1 min-w-[200px] bg-[#0d0d0d] border border-[#252525] rounded-lg px-3 py-2 text-[13px] text-[#f5f0e8] placeholder-[#444]"
          />
          <input
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            placeholder="Company name (optional)"
            className="flex-1 min-w-[200px] bg-[#0d0d0d] border border-[#252525] rounded-lg px-3 py-2 text-[13px] text-[#f5f0e8] placeholder-[#444]"
          />
          <button
            onClick={createInvitation}
            className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[13px] font-semibold">
            Create
          </button>
        </div>
        {lastInviteUrl && (
          <div className="text-[12px] text-[#c9a84c] break-all bg-[#0d0d0d] rounded-lg px-3 py-2">
            {lastInviteUrl}
            <button
              onClick={() => navigator.clipboard.writeText(lastInviteUrl)}
              className="ml-2 text-[#888] hover:text-[#c9a84c] underline">
              copy
            </button>
          </div>
        )}
      </section>

      {/* Invitations list */}
      <section className="mb-10">
        <h2 className="text-[13px] font-semibold text-[#c8c0b0] mb-3">Invitations</h2>
        <div className="rounded-2xl border border-[#1a1a1a] divide-y divide-[#141414]">
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-[13px] text-[#c8c0b0]">
                  {inv.email} {inv.companyName && <span className="text-[#555]">· {inv.companyName}</span>}
                </p>
                <p className="text-[11px] text-[#555]">
                  {inv.status} · created {new Date(inv.createdAt).toLocaleDateString()}
                </p>
              </div>
              {inv.status === "pending" && (
                <button
                  onClick={() => runAction("revoke_invitation", { invitationId: inv.id })}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/5">
                  Revoke
                </button>
              )}
            </div>
          ))}
          {invitations.length === 0 && <p className="text-[12px] text-[#555] px-4 py-3">No invitations yet.</p>}
        </div>
      </section>

      {/* Testers */}
      <section>
        <h2 className="text-[13px] font-semibold text-[#c8c0b0] mb-3">Testers</h2>
        <div className="space-y-3">
          {testers.map((t) => {
            const isOpen = expanded === t.membershipId;
            const totalCostMicro = Object.values(t.aiUsage).reduce((sum, u) => sum + u.costMicroUsd, 0);
            return (
              <div key={t.membershipId} className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : t.membershipId)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div>
                    <p className="text-[13px] text-[#c8c0b0] font-medium">
                      {t.userEmail ?? t.invitationEmail}{" "}
                      {t.companyName && <span className="text-[#555]">· {t.companyName}</span>}
                    </p>
                    <p className="text-[11px] text-[#555]">
                      {t.membershipStatus} · {t.activeDaysUsed} active days · {microUsd(totalCostMicro)} spent
                    </p>
                  </div>
                  <span className="text-[#555]">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="px-4 pb-5 pt-1 border-t border-[#141414] space-y-4">
                    {/* Core status */}
                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <p className="text-[#555]">Hard end</p>
                        <p className="text-[#c8c0b0]">{new Date(t.hardEndAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[#555]">Extension</p>
                        <p className="text-[#c8c0b0]">
                          {t.extendedDays > 0 ? `+${t.extendedDays}d by ${t.extensionGrantedBy}` : "None"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#555]">Searches / Deep / Lead views</p>
                        <p className="text-[#c8c0b0]">
                          {t.searchesCompleted} / {t.deepSearchesCompleted} / {t.leadDetailViews}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#555]">Outcomes (C/R/B/Cl)</p>
                        <p className="text-[#c8c0b0]">
                          {t.outcomes.contacted}/{t.outcomes.replied}/{t.outcomes.bookedCall}/{t.outcomes.closed}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#555]">Final interview</p>
                        <p className="text-[#c8c0b0]">{t.finalInterviewCompleted ? "✓ Completed" : "Pending"}</p>
                      </div>
                      <div>
                        <p className="text-[#555]">Required feedback</p>
                        <p className="text-[#c8c0b0]">{t.requiredFeedbackCompleted ? "✓ Completed" : "Pending"}</p>
                      </div>
                      <div>
                        <p className="text-[#555]">Testimonial</p>
                        <p className="text-[#c8c0b0]">{t.testimonialStatus ?? "None"}</p>
                      </div>
                      <div>
                        <p className="text-[#555]">Discount</p>
                        <p className="text-[#c8c0b0]">
                          {t.discountStatus ? `${t.discountStatus} (${t.discountPercent}%)` : "Not eligible yet"}
                        </p>
                      </div>
                    </div>

                    {/* AI usage breakdown */}
                    <div>
                      <p className="text-[11px] text-[#555] mb-1">AI usage</p>
                      <div className="flex gap-3 text-[12px] text-[#c8c0b0]">
                        {Object.entries(t.aiUsage).map(([feature, u]) => (
                          <span key={feature}>
                            {feature}: {u.count} ({microUsd(u.costMicroUsd)})
                          </span>
                        ))}
                        {Object.keys(t.aiUsage).length === 0 && <span className="text-[#555]">None yet</span>}
                      </div>
                    </div>

                    {/* Feature ratings + comments */}
                    <div>
                      <p className="text-[11px] text-[#555] mb-1">Feature ratings</p>
                      <div className="space-y-1">
                        {t.featureRatings.map((r) => (
                          <p key={r.featureKey} className="text-[12px] text-[#c8c0b0]">
                            {r.featureKey}: {r.notUsedEnough ? "not used enough" : `${r.rating}/5`}
                            {r.freeText && <span className="text-[#888]"> — &quot;{r.freeText}&quot;</span>}
                          </p>
                        ))}
                        {t.featureRatings.length === 0 && <p className="text-[12px] text-[#555]">No ratings yet</p>}
                      </div>
                    </div>

                    {/* Internal notes */}
                    <div>
                      <p className="text-[11px] text-[#555] mb-1">Internal notes</p>
                      <textarea
                        defaultValue={t.internalNotes ?? ""}
                        onBlur={(e) =>
                          runAction("set_internal_notes", { membershipId: t.membershipId, notes: e.target.value })
                        }
                        rows={2}
                        className="w-full bg-[#080808] border border-[#252525] rounded-lg px-3 py-2 text-[12px] text-[#f5f0e8]"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[#141414]">
                      <button
                        onClick={() => {
                          const days = Number(prompt("Extension days", "7"));
                          if (days) runAction("grant_extension", { membershipId: t.membershipId, days });
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.25)] text-[#c9a84c]">
                        Extend
                      </button>
                      <button
                        onClick={() => runAction("expire_membership", { membershipId: t.membershipId })}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999]">
                        Expire
                      </button>
                      <button
                        onClick={() => runAction("revoke_membership", { membershipId: t.membershipId })}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400">
                        Revoke
                      </button>
                      <button
                        onClick={() =>
                          runAction("mark_interview_completed", { membershipId: t.membershipId, userId: t.userId })
                        }
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999]">
                        Mark interview done
                      </button>
                      <button
                        onClick={() =>
                          runAction("mark_required_feedback_completed", {
                            membershipId: t.membershipId,
                            userId: t.userId,
                          })
                        }
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999]">
                        Mark feedback done
                      </button>
                      <button
                        onClick={() =>
                          runAction("award_discount_manually", { membershipId: t.membershipId, userId: t.userId })
                        }
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999]">
                        Award discount
                      </button>
                      <button
                        onClick={() => {
                          const val = prompt("Monetary ceiling in USD (blank = use default)", "");
                          if (val === null) return;
                          const micro = val.trim() === "" ? null : Math.round(Number(val) * 1_000_000);
                          runAction("set_monetary_ceiling", { membershipId: t.membershipId, ceilingMicroUsd: micro });
                        }}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999]">
                        Set ceiling
                      </button>
                      {(["outreach", "followup", "ai_deep_search"] as const).map((feature) => (
                        <button
                          key={feature}
                          onClick={() => {
                            const daily = prompt(`${feature} daily limit (blank = default)`, "");
                            if (daily === null) return;
                            const total = prompt(`${feature} total limit (blank = default)`, "");
                            if (total === null) return;
                            runAction("set_allowance_override", {
                              membershipId: t.membershipId,
                              feature,
                              dailyLimit: daily.trim() === "" ? null : Number(daily),
                              totalLimit: total.trim() === "" ? null : Number(total),
                            });
                          }}
                          className="text-[11px] px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-[#999]">
                          {feature} limit
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {testers.length === 0 && <p className="text-[12px] text-[#555]">No testers yet.</p>}
        </div>
      </section>
    </div>
  );
}
