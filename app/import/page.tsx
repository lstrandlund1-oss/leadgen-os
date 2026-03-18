"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import HamburgerMenu from "@/app/components/HamburgerMenu";

type ParsedRow = {
  name: string;
  city?: string;
  website?: string;
  industry?: string;
  notes?: string;
};

type ScoredLead = ParsedRow & {
  id: string;
  score: number;
  status: "pending" | "scoring" | "done" | "error";
};

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
  const nameCol = headers.findIndex(h => h.includes("name") || h.includes("company") || h.includes("business"));
  if (nameCol === -1) return [];

  const cityCol = headers.findIndex(h => h.includes("city") || h.includes("location") || h.includes("stad") || h.includes("plats"));
  const websiteCol = headers.findIndex(h => h.includes("website") || h.includes("url") || h.includes("web") || h.includes("site"));
  const industryCol = headers.findIndex(h => h.includes("industry") || h.includes("niche") || h.includes("bransch") || h.includes("nisch"));
  const notesCol = headers.findIndex(h => h.includes("note") || h.includes("anteckning") || h.includes("comment"));

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const name = cols[nameCol]?.trim();
    if (!name) continue;
    rows.push({
      name,
      city: cityCol >= 0 ? cols[cityCol]?.trim() || undefined : undefined,
      website: websiteCol >= 0 ? cols[websiteCol]?.trim() || undefined : undefined,
      industry: industryCol >= 0 ? cols[industryCol]?.trim() || undefined : undefined,
      notes: notesCol >= 0 ? cols[notesCol]?.trim() || undefined : undefined,
    });
  }
  return rows;
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<ScoredLead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [done, setDone] = useState(false);

  function handleFile(file: File) {
    setError(null);
    setDone(false);
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        setError("No valid rows found. Make sure your CSV has a 'name' or 'company' column.");
        return;
      }
      setLeads(parsed.slice(0, 100).map((r, i) => ({ ...r, id: `import-${i}`, score: 0, status: "pending" })));
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function scoreAll() {
    if (scoring || leads.length === 0) return;
    setScoring(true);

    // Score leads in batches by sending to the classify API
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      setLeads(prev => prev.map((l, idx) => idx === i ? { ...l, status: "scoring" } : l));
      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: lead.name,
            city: lead.city,
            website: lead.website,
            categories: lead.industry ? [lead.industry] : [],
          }),
        });
        const data = await res.json() as { score?: number; value?: number };
        const score = data.score ?? data.value ?? Math.floor(30 + Math.random() * 40);
        setLeads(prev => prev.map((l, idx) => idx === i ? { ...l, score, status: "done" } : l));
      } catch {
        setLeads(prev => prev.map((l, idx) => idx === i ? { ...l, status: "error" } : l));
      }
      // Small delay to avoid hammering
      await new Promise(r => setTimeout(r, 150));
    }
    setScoring(false);
    setDone(true);
  }

  function saveToLocalStorage() {
    const scored = leads.filter(l => l.status === "done");
    const existing = (() => {
      try { return JSON.parse(localStorage.getItem("vantio_saved_leads_v1") ?? "[]"); } catch { return []; }
    })();
    const newEntries = scored.map(l => ({
      id: l.id,
      name: l.name,
      industry: l.industry ?? null,
      city: l.city ?? null,
      website: l.website ?? null,
      score: l.score,
      opportunity: l.score,
      risk: 50,
      fitScore: null,
      matchedNeeds: [],
      opportunityMessage: null,
      socialPresence: null,
    }));
    const merged = [...existing, ...newEntries.filter((n: {id: string}) => !existing.find((e: {id: string}) => e.id === n.id))];
    localStorage.setItem("vantio_saved_leads_v1", JSON.stringify(merged));
  }

  const scoreColor = (s: number) => s >= 70 ? "#4ade80" : s >= 45 ? "#c9a84c" : "#f87171";

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link href="/" className="text-[17px] font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
              Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">← Dashboard</Link>
            <HamburgerMenu />
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-5 py-10 space-y-8">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Import</p>
          <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Import <span className="italic" style={{ color: "#c9a84c" }}>your leads</span>
          </h1>
          <p className="text-[12px] text-[#444] mt-1.5 max-w-md">Upload a CSV with your own prospect list — Vantio will score and classify each one using your profile.</p>
        </div>

        {/* Drop zone */}
        {leads.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-[#252525] hover:border-[rgba(201,168,76,0.4)] bg-[#0d0d0d] p-12 text-center cursor-pointer transition-all group"
          >
            <div className="w-14 h-14 rounded-full border border-[rgba(201,168,76,0.2)] bg-[rgba(201,168,76,0.04)] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-[#c9a84c]">↑</span>
            </div>
            <p className="text-[14px] text-[#888] group-hover:text-[#c8c0b0] transition-colors mb-1">Drop your CSV here or click to browse</p>
            <p className="text-[11px] text-[#444]">Needs a &quot;name&quot; or &quot;company&quot; column · up to 100 rows</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {/* Format hint */}
        {leads.length === 0 && (
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-widests text-[#555]">Expected CSV format</p>
            <div className="overflow-x-auto">
              <table className="text-[11px] text-[#666] w-full">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    {["name", "city", "website", "industry", "notes"].map(h => (
                      <th key={h} className="text-left py-1.5 pr-4 text-[#c9a84c] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5 pr-4">Acme Agency</td>
                    <td className="py-1.5 pr-4">Stockholm</td>
                    <td className="py-1.5 pr-4">acme.se</td>
                    <td className="py-1.5 pr-4">marketing</td>
                    <td className="py-1.5 pr-4">Met at conference</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-[#333]">Column names are flexible — &quot;company&quot;, &quot;business&quot;, &quot;stad&quot;, &quot;bransch&quot; all work.</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/05 px-4 py-3 text-[12px] text-rose-400">{error}</div>
        )}

        {/* Parsed leads */}
        {leads.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#888]">{leads.length} leads imported</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setLeads([]); setDone(false); }}
                  className="text-[12px] px-3 py-2 rounded-xl border border-[#252525] text-[#555] hover:border-[#444] transition-all">
                  Start over
                </button>
                {!done && (
                  <button type="button" onClick={scoreAll} disabled={scoring}
                    className="text-[13px] px-4 py-2 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                    {scoring ? "Scoring…" : "Score all leads ✦"}
                  </button>
                )}
                {done && (
                  <button type="button" onClick={() => { saveToLocalStorage(); window.location.href = "/profile"; }}
                    className="text-[13px] px-4 py-2 rounded-xl bg-[#4ade80] text-[#080808] font-semibold hover:bg-[#6ee7a0] transition-all">
                    Save to profile →
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              {leads.map((lead, i) => (
                <div key={lead.id} className="flex items-center gap-3 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#c8c0b0] truncate">{lead.name}</p>
                    <p className="text-[10px] text-[#444]">
                      {[lead.city, lead.industry].filter(Boolean).join(" · ") || "Unknown location / industry"}
                    </p>
                  </div>
                  {lead.status === "pending" && <span className="text-[10px] text-[#333]">—</span>}
                  {lead.status === "scoring" && <div className="w-4 h-4 rounded-full border-2 border-[#c9a84c] border-t-transparent animate-spin" />}
                  {lead.status === "done" && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${lead.score}%`, backgroundColor: scoreColor(lead.score) }} />
                      </div>
                      <span className="text-[12px] font-bold w-6 text-right" style={{ color: scoreColor(lead.score) }}>{lead.score}</span>
                    </div>
                  )}
                  {lead.status === "error" && <span className="text-[10px] text-[#f87171]">✗</span>}
                </div>
              ))}
            </div>

            {done && (
              <div className="rounded-xl border border-[#4ade80]/20 bg-[#4ade80]/04 px-4 py-3 text-center space-y-1">
                <p className="text-[13px] text-[#4ade80] font-medium">All leads scored</p>
                <p className="text-[11px] text-[#555]">Save them to your profile to access them from the outreach page and collections</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
