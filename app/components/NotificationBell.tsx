"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { WorkItem, WorkItemType } from "@/lib/notifications/getTodaysWork";

export type Notification = WorkItem;

// Purely local UX state — which items the user has already seen, so the
// unread badge doesn't nag about the same overdue follow-up forever.
// This is NOT the source of truth for what's shown: the item itself
// keeps appearing on every fetch for as long as it's genuinely true
// (the follow-up is still overdue, the lead is still stale). Marking it
// "seen" only silences the badge, it never hides real, current work.
const SEEN_KEY = "vantio_notifications_seen";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* ignore */
  }
}

export function useNotifications() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/today");
      if (!res.ok) return;
      const data = (await res.json()) as { items?: WorkItem[] };
      setItems(data.items ?? []);
    } catch {
      // leave items as-is on failure — don't clear real work off a transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh periodically so the badge stays current for anyone who
    // leaves a tab open rather than only updating on page load.
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  function markAllRead() {
    const next = new Set(seen);
    for (const item of items) next.add(item.id);
    setSeen(next);
    saveSeen(next);
  }

  function markRead(id: string) {
    const next = new Set(seen).add(id);
    setSeen(next);
    saveSeen(next);
  }

  const notifications = items.map((item) => ({ ...item, read: seen.has(item.id) }));
  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, markAllRead, markRead, refresh };
}

// Module-level helper — not called during render, only in event handlers
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [btnPos, setBtnPos] = useState({ top: 16, left: 16 });
  const [btnRef, setBtnRef] = useState<HTMLButtonElement | null>(null);
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function openBell(btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();
    setBtnPos({ top: r.bottom + 8, left: Math.max(8, r.right - 320) });
    setOpen(true);
    markAllRead();
  }

  const typeIcon = (type: WorkItemType) => (type === "overdue_followup" ? "↩" : type === "stale_lead" ? "⚠" : "✦");

  const portal =
    typeof window !== "undefined" && open
      ? createPortal(
          <>
            <div
              onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 99996 }}
              aria-hidden="true"
            />
            <div
              style={{
                position: "fixed",
                top: btnPos.top,
                left: btnPos.left,
                zIndex: 99997,
                width: 320,
                maxHeight: "70vh",
                background: "#111",
                border: "1px solid rgba(201,168,76,0.25)",
                borderRadius: 12,
                boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}>
              {/* Header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
                <p
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "#8a6e30",
                    marginBottom: 2,
                  }}>
                  Today's Work
                </p>
                <p style={{ fontSize: 11, color: "#444" }}>
                  {notifications.length === 0
                    ? "Nothing needs attention right now"
                    : `${notifications.length} item${notifications.length === 1 ? "" : "s"}`}
                </p>
              </div>

              {/* List */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: "40px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 24, marginBottom: 8 }}>◎</p>
                    <p style={{ fontSize: 13, color: "#444" }}>Nothing needs attention</p>
                    <p style={{ fontSize: 11, color: "#333", marginTop: 4 }}>
                      Overdue follow-ups and stale leads will appear here
                    </p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #141414",
                        background: n.read ? "transparent" : "rgba(201,168,76,0.03)",
                        cursor: n.href ? "pointer" : "default",
                      }}
                      onClick={() => {
                        markRead(n.id);
                        if (n.href) {
                          setOpen(false);
                          window.location.href = n.href;
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (n.href) (e.currentTarget as HTMLElement).style.background = "#1a1a1a";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = n.read
                          ? "transparent"
                          : "rgba(201,168,76,0.03)";
                      }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 12, color: n.read ? "#444" : "#c9a84c", marginTop: 1, flexShrink: 0 }}>
                          {typeIcon(n.type)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              marginBottom: 2,
                            }}>
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: n.read ? "#666" : "#c8c0b0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                              {n.title}
                            </p>
                            {!n.read && (
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: "#c9a84c",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: "#555", lineHeight: 1.4, marginBottom: 4 }}>{n.reason}</p>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <p style={{ fontSize: 10, color: "#333" }}>{timeAgo(n.createdAt)}</p>
                            {n.href && <p style={{ fontSize: 10, color: "#8a6e30" }}>View →</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid #1a1a1a" }}>
                <Link
                  href="/settings#notifications"
                  onClick={() => setOpen(false)}
                  style={{ fontSize: 11, color: "#555", textDecoration: "none", display: "block", textAlign: "center" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#888")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "#555")}>
                  Notification settings ⚙
                </Link>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={(el) => setBtnRef(el)}
        type="button"
        onClick={() => (open ? setOpen(false) : btnRef && openBell(btnRef))}
        aria-label="Notifications"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 8,
          border: "1px solid #252525",
          background: "#111",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8a6e30")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#252525")}>
        {/* Bell icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#888"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "#c9a84c",
              color: "#080808",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              lineHeight: 1,
            }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {portal}
    </>
  );
}
