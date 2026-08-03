"use client";

import { useEffect, useState } from "react";
import { getTranslations } from "@/lib/i18n";
import { getStoredLanguage } from "@/lib/languagePreference";
import HamburgerMenu from "@/app/components/HamburgerMenu";
import type { Market } from "@/lib/markets/markets";
import type { MarketSnapshot } from "@/lib/markets/getMarketSnapshot";

export default function MarketsPage() {
  const [language] = useState(() => getStoredLanguage());
  const t = getTranslations(language).ui.markets;

  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  function loadMarkets() {
    return fetch("/api/markets")
      .then((res) => (res.ok ? res.json() : { markets: [] }))
      .then((data) => {
        const list: Market[] = data.markets ?? [];
        setMarkets(list);
        setSelectedId((current) => current ?? (list.length > 0 ? list[0].id : null));
      })
      .catch(() => setMarkets([]));
  }

  useEffect(() => {
    loadMarkets().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSnapshot(null);
      return;
    }
    fetch(`/api/markets/${selectedId}/snapshot`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSnapshot(data))
      .catch(() => setSnapshot(null));
  }, [selectedId]);

  async function handleCreate() {
    if (!name.trim() || !niche.trim() || !location.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, niche, location }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowCreate(false);
        setName("");
        setNiche("");
        setLocation("");
        await loadMarkets();
        if (data.market?.id) setSelectedId(data.market.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRefresh() {
    if (!selectedId || refreshing) return;
    setRefreshing(true);
    try {
      await fetch(`/api/markets/${selectedId}/refresh`, { method: "POST" });
      const res = await fetch(`/api/markets/${selectedId}/snapshot`);
      if (res.ok) setSnapshot(await res.json());
      await loadMarkets();
    } finally {
      setRefreshing(false);
    }
  }

  const selectedMarket = markets?.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
        <h1 className="text-[18px] tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
          Vantio
        </h1>
        <HamburgerMenu hasProfile={true} />
      </nav>

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
            <h3 className="text-[14px] font-medium">{t.createTitle}</h3>
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
              <label className="text-[11px] text-[#666]">{t.nicheLabel}</label>
              <input
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder={t.nichePlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8] placeholder:text-[#444]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[#666]">{t.locationLabel}</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t.locationPlaceholder}
                className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#252525] text-[13px] text-[#f5f0e8] placeholder:text-[#444]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !name.trim() || !niche.trim() || !location.trim()}
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

        {!loading && markets && markets.length === 0 && !showCreate && (
          <div className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 text-center py-12 space-y-2">
            <p className="text-[14px] text-[#f5f0e8]">{t.emptyStateTitle}</p>
            <p className="text-[13px] text-[#666] max-w-sm mx-auto">{t.emptyStateBody}</p>
          </div>
        )}

        {!loading && markets && markets.length > 0 && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {markets.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={
                    "px-3 py-1.5 rounded-lg text-[12px] border transition-colors " +
                    (m.id === selectedId
                      ? "border-[#c9a84c] text-[#c9a84c] bg-[rgba(201,168,76,0.08)]"
                      : "border-[#252525] text-[#888] hover:border-[#444]")
                  }>
                  {m.name}
                </button>
              ))}
            </div>

            {selectedMarket && snapshot && (
              <section className="bg-[#111111] border border-[#252525] rounded-2xl p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-medium text-[#f5f0e8]">{selectedMarket.name}</p>
                    <p className="text-[11px] text-[#666] mt-0.5">
                      {selectedMarket.lastRefreshedAt
                        ? `${t.lastRefreshed}: ${new Date(selectedMarket.lastRefreshedAt).toLocaleDateString()}`
                        : t.neverRefreshed}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-4 py-2 rounded-lg border border-[#c9a84c]/30 text-[#c9a84c] text-[12px] font-medium hover:bg-[rgba(201,168,76,0.08)] disabled:opacity-40 transition-colors">
                    {refreshing ? t.refreshing : t.refresh}
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Stat label={t.totalCompanies} value={snapshot.totalCompanies} />
                  <Stat label={t.highOpportunity} value={snapshot.highOpportunityCount} color="#c9a84c" />
                  <Stat label={t.goodOpportunity} value={snapshot.goodOpportunityCount} />
                  <Stat label={t.contacted} value={snapshot.contactedCount} />
                  <Stat label={t.lostNotFit} value={snapshot.lostOrNotFitCount} />
                  <Stat label={t.newThisMonth} value={snapshot.newThisMonth} />
                </div>

                <div className="pt-2 border-t border-[#1e1e1e]">
                  <p className="text-[11px] text-[#666] mb-1" title={t.coverageTooltip}>
                    {t.estimatedCoverage}
                  </p>
                  <p className="text-[18px] font-semibold text-[#f5f0e8]">
                    {snapshot.estimatedCoveragePct !== null
                      ? `${Math.round(snapshot.estimatedCoveragePct * 100)}%`
                      : "—"}
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-3">
      <p className="text-[11px] text-[#666] mb-0.5">{label}</p>
      <p className="text-[18px] font-semibold" style={{ color: color ?? "#f5f0e8" }}>
        {value}
      </p>
    </div>
  );
}
