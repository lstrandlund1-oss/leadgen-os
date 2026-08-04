"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";

type Member = { userId: string; email: string | null; role: string; joinedAt: string };
type Invitation = { id: string; invitedEmail: string; status: string; createdAt: string };

export default function MembersPage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.members;

  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState(false);

  function loadMembers() {
    return fetch("/api/workspace/members")
      .then((res) => (res.ok ? res.json() : { workspace: null, members: [], invitations: [] }))
      .then((data) => {
        setWorkspace(data.workspace);
        setMembers(data.members ?? []);
        setInvitations(data.invitations ?? []);
      })
      .catch(() => setWorkspace(null));
  }

  useEffect(() => {
    loadMembers().finally(() => setLoading(false));
  }, []);

  async function handleInvite() {
    if (!inviteEmail.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/workspace/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      if (res.ok) {
        setInviteEmail("");
        setShowInvite(false);
        setSentMessage(true);
        setTimeout(() => setSentMessage(false), 3000);
        await loadMembers();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="max-w-2xl mx-auto px-6 py-10">
          <header className="flex items-center justify-between mb-6">
            <h2 className="text-[26px] font-light" style={{ fontFamily: "var(--font-display), serif" }}>
              {t.title}
            </h2>
            <button
              type="button"
              onClick={() => setShowInvite((v) => !v)}
              className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold hover:bg-[#e8c97a] transition-colors">
              {t.inviteButton}
            </button>
          </header>

          {sentMessage && (
            <div className="mb-4 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-[12px] text-emerald-400">
              {t.inviteSent}
            </div>
          )}

          {showInvite && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mb-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">{t.inviteEmailLabel}</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t.inviteEmailPlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8] placeholder:text-[#444]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={sending || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold hover:bg-[#e8c97a] disabled:opacity-40 transition-colors">
                  {t.sendInvite}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2 rounded-lg border border-[#252525] text-[#999] text-[12px] hover:border-[#444] transition-colors">
                  {t.cancel}
                </button>
              </div>
            </section>
          )}

          {loading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

          {!loading && workspace === null && (
            <p className="text-[13px] text-[#666] py-10 text-center">{t.noWorkspace}</p>
          )}

          {!loading && workspace && (
            <>
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mb-6">
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-[13px] text-[#f5f0e8]">{m.email ?? m.userId}</p>
                        <p className="text-[11px] text-[#666]">
                          {t.joined}: {new Date(m.joinedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={
                          "text-[10px] px-2 py-1 rounded-full uppercase tracking-wide " +
                          (m.role === "owner" ? "bg-[rgba(201,168,76,0.1)] text-[#c9a84c]" : "bg-[#1a1a1a] text-[#888]")
                        }>
                        {m.role === "owner" ? t.roleOwner : t.roleMember}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5">
                <h3 className="text-[13px] font-medium text-[#f5f0e8] mb-3">{t.pendingInvitations}</h3>
                {invitations.length === 0 ? (
                  <p className="text-[12px] text-[#666]">{t.noPendingInvitations}</p>
                ) : (
                  <div className="space-y-2">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-1.5">
                        <p className="text-[13px] text-[#999]">{inv.invitedEmail}</p>
                        <p className="text-[11px] text-[#555]">{new Date(inv.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
