"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type Collection = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
  lead_collection_items?: [{ count: number }];
};
type CollectionItem = {
  id: string;
  collection_id: string;
  lead_id: string;
  company_name: string | null;
  notes: string | null;
  added_at: string;
};

const COLORS = ["#c9a84c", "#4ade80", "#818cf8", "#fb923c", "#f87171", "#34d399", "#60a5fa", "#e879f9"];

export default function CollectionsPage() {
  const supabase = createSupabaseBrowser();
  const [userEmail, setUserEmail] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Collection | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d: { collections?: Collection[] }) => {
        setCollections(d.collections ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function loadItems(collection: Collection) {
    setSelected(collection);
    const res = await fetch(`/api/collections/items?collection_id=${collection.id}`);
    const d = (await res.json()) as { items?: CollectionItem[] };
    setItems(d.items ?? []);
  }

  async function createCollection() {
    if (!newName.trim() || saving) return;
    setSaving(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), color: newColor }),
    });
    const d = (await res.json()) as { collection?: Collection };
    if (d.collection) {
      setCollections((prev) => [d.collection!, ...prev]);
      setNewName("");
      setCreating(false);
    }
    setSaving(false);
  }

  async function deleteCollection(id: string) {
    await fetch("/api/collections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) {
      setSelected(null);
      setItems([]);
    }
  }

  async function removeItem(id: string) {
    await fetch("/api/collections/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-[#c9a84c]">◈</span>
              <Link
                href="/"
                className="text-[17px] font-light tracking-wide"
                style={{ fontFamily: "var(--font-display), serif" }}>
                Van
                <span
                  style={{
                    background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                  tio
                </span>
              </Link>
              <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">
                Beta
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">
                ← Dashboard
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-5 py-10">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Organize</p>
              <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
                Lead{" "}
                <span className="italic" style={{ color: "#c9a84c" }}>
                  Collections
                </span>
              </h1>
              <p className="text-[12px] text-[#444] mt-1.5">
                Group leads into named lists — by client, campaign, or niche
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="px-4 py-2.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[13px] hover:bg-[#e8c97a] transition-all">
              + New collection
            </button>
          </div>

          {creating && (
            <div className="rounded-2xl border border-[rgba(201,168,76,0.3)] bg-[rgba(201,168,76,0.04)] p-5 mb-6 space-y-4">
              <p className="text-[11px] uppercase tracking-widest text-[#8a6e30]">New collection</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Hot leads — Stockholm Q2"
                className="w-full bg-[#080808] border border-[#252525] rounded-xl px-4 py-3 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors"
                onKeyDown={(e) => e.key === "Enter" && createCollection()}
                autoFocus
              />
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-[#555]">Color</p>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={
                        "w-6 h-6 rounded-full border-2 transition-all " +
                        (newColor === c ? "border-white scale-110" : "border-transparent")
                      }
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={createCollection}
                  disabled={!newName.trim() || saving}
                  className="flex-1 py-2.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[13px] hover:bg-[#e8c97a] disabled:opacity-50 transition-all">
                  {saving ? "Creating…" : "Create collection"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#252525] text-[#555] text-[13px] hover:border-[#444] transition-all">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-[280px_1fr] gap-6 items-start">
            {/* Collections list */}
            <div className="space-y-2">
              {loading ? (
                <div className="py-10 text-center text-[#444] animate-pulse text-sm">Loading…</div>
              ) : collections.length === 0 ? (
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-8 text-center space-y-2">
                  <p className="text-2xl">◈</p>
                  <p className="text-[13px] text-[#444]">No collections yet</p>
                  <p className="text-[11px] text-[#333]">Create one to start grouping your leads</p>
                </div>
              ) : (
                collections.map((c) => {
                  const count = c.lead_collection_items?.[0]?.count ?? 0;
                  const isActive = selected?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={
                        "rounded-xl border transition-all cursor-pointer group " +
                        (isActive
                          ? "border-[rgba(201,168,76,0.4)] bg-[rgba(201,168,76,0.06)]"
                          : "border-[#1a1a1a] bg-[#0d0d0d] hover:border-[#252525]")
                      }
                      onClick={() => loadItems(c)}>
                      <div className="flex items-center gap-3 p-3.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                        <div className="flex-1 min-w-0">
                          <p
                            className={
                              "text-[13px] font-medium truncate " + (isActive ? "text-[#e8c97a]" : "text-[#c8c0b0]")
                            }>
                            {c.name}
                          </p>
                          <p className="text-[10px] text-[#444]">
                            {count} lead{count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCollection(c.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-[#f87171] transition-all text-sm">
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Collection items */}
            <div>
              {!selected ? (
                <div className="rounded-2xl border border-[#151515] bg-[#0a0a0a] p-12 text-center space-y-3">
                  <p className="text-3xl text-[#222]">◆</p>
                  <p className="text-[13px] text-[#444]">Select a collection to view its leads</p>
                  <p className="text-[11px] text-[#2a2a2a]">Add leads to collections from the dashboard lead panel</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selected.color }} />
                      <p className="text-[15px] font-semibold text-[#c8c0b0]">{selected.name}</p>
                      <span className="text-[11px] text-[#444]">
                        {items.length} lead{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-10 text-center space-y-2">
                      <p className="text-[13px] text-[#444]">No leads in this collection yet</p>
                      <p className="text-[11px] text-[#333]">
                        Open a lead in the dashboard and click &ldquo;Add to collection&rdquo;
                      </p>
                      <Link
                        href="/dashboard"
                        className="inline-block mt-1 text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors">
                        Go to Dashboard →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] px-4 py-3 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-[#c8c0b0] truncate">
                              {item.company_name ?? item.lead_id}
                            </p>
                            {item.notes && <p className="text-[11px] text-[#444] mt-0.5 truncate">{item.notes}</p>}
                            <p className="text-[10px] text-[#333] mt-0.5">
                              {new Date(item.added_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href="/dashboard"
                              className="text-[11px] text-[#555] hover:text-[#c9a84c] transition-colors">
                              Open →
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="text-[#333] hover:text-[#f87171] transition-colors text-sm">
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
