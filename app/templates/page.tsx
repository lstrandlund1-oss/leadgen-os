"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import Sidebar from "@/app/components/Sidebar";

type Template = {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  body: string;
  tone: string | null;
  created_at: string;
};

export default function TemplatesPage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.templates;

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  function loadTemplates() {
    return fetch("/api/outreach/templates")
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => setTemplates([]));
  }

  useEffect(() => {
    loadTemplates().finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!name.trim() || !body.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/outreach/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, channel, subject: subject || undefined, body }),
      });
      if (res.ok) {
        setShowCreate(false);
        setName("");
        setSubject("");
        setBody("");
        setChannel("email");
        await loadTemplates();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch("/api/outreach/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadTemplates();
  }

  const channelLabel: Record<string, string> = {
    email: t.channelEmail,
    linkedin: t.channelLinkedin,
    cold_call: t.channelCold,
  };

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
              onClick={() => setShowCreate((v) => !v)}
              className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold hover:bg-[#e8c97a] transition-colors">
              {t.createButton}
            </button>
          </header>

          {showCreate && (
            <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 mb-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">{t.nameLabel}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8] placeholder:text-[#444]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">{t.channelLabel}</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8]">
                  <option value="email">{t.channelEmail}</option>
                  <option value="linkedin">{t.channelLinkedin}</option>
                  <option value="cold_call">{t.channelCold}</option>
                </select>
              </div>
              {channel === "email" && (
                <div className="space-y-1">
                  <label className="text-[11px] text-[#666]">{t.subjectLabel}</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t.subjectPlaceholder}
                    className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8] placeholder:text-[#444]"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[11px] text-[#666]">{t.bodyLabel}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t.bodyPlaceholder}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8] placeholder:text-[#444] resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={saving || !name.trim() || !body.trim()}
                  className="px-4 py-2 rounded-lg bg-[#c9a84c] text-[#080808] text-[12px] font-semibold hover:bg-[#e8c97a] disabled:opacity-40 transition-colors">
                  {t.save}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg border border-[#252525] text-[#999] text-[12px] hover:border-[#444] transition-colors">
                  {t.cancel}
                </button>
              </div>
            </section>
          )}

          {loading && <p className="text-[13px] text-[#666] py-10 text-center">{t.loading}</p>}

          {!loading && templates && templates.length === 0 && !showCreate && (
            <div className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 text-center py-12 space-y-2">
              <p className="text-[14px] text-[#f5f0e8]">{t.emptyStateTitle}</p>
              <p className="text-[13px] text-[#666] max-w-sm mx-auto">{t.emptyStateBody}</p>
            </div>
          )}

          {!loading && templates && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((tpl) => (
                <div key={tpl.id} className="bg-[#111111] border border-[#252525] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-[#f5f0e8]">{tpl.name}</p>
                      <p className="text-[11px] text-[#666] mt-0.5">
                        {channelLabel[tpl.channel] ?? tpl.channel}
                        {tpl.subject && ` · ${tpl.subject}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl.id)}
                      className="shrink-0 text-[11px] text-[#666] hover:text-[#f87171] transition-colors">
                      {t.delete}
                    </button>
                  </div>
                  <p className="text-[13px] text-[#999] mt-2 whitespace-pre-wrap line-clamp-3">{tpl.body}</p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
