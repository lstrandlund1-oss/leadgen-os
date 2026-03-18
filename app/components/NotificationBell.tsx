"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export type Notification = {
  id: string;
  type: "followup" | "deal_closed" | "weekly_digest" | "general";
  title: string;
  body: string;
  href?: string;
  read: boolean;
  createdAt: string;
};

const STORAGE_KEY = "vantio_notifications";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
  });

  function save(notifs: Notification[]) {
    setNotifications(notifs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs)); } catch { /* ignore */ }
  }

  function addNotification(n: Omit<Notification, "id" | "read" | "createdAt">) {
    const notif: Notification = {
      ...n,
      id: Date.now().toString(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [notif, ...notifications].slice(0, 50);
    save(updated);
    return notif;
  }

  function markAllRead() {
    save(notifications.map(n => ({ ...n, read: true })));
  }

  function clearAll() {
    save([]);
  }

  function markRead(id: string) {
    save(notifications.map(n => n.id === id ? { ...n, read: true } : n));
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, addNotification, markAllRead, clearAll, markRead };
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

export default function NotificationBell({ emailNotifications }: { emailNotifications?: boolean }) {
  const [open, setOpen] = useState(false);
  const [btnPos, setBtnPos] = useState({ top: 16, left: 16 });
  const [btnRef, setBtnRef] = useState<HTMLButtonElement | null>(null);
  const { notifications, unreadCount, markAllRead, clearAll, markRead } = useNotifications();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  function openBell(btn: HTMLButtonElement) {
    const r = btn.getBoundingClientRect();
    setBtnPos({ top: r.bottom + 8, left: Math.max(8, r.right - 320) });
    setOpen(true);
    markAllRead();
  }



  const typeIcon = (type: Notification["type"]) =>
    type === "followup" ? "↩" : type === "deal_closed" ? "✦" : type === "weekly_digest" ? "◉" : "◈";

  const portal = (typeof window !== "undefined") && open ? createPortal(
    <>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99996 }} aria-hidden="true" />
      <div style={{
        position: "fixed", top: btnPos.top, left: btnPos.left,
        zIndex: 99997, width: 320, maxHeight: "70vh",
        background: "#111", border: "1px solid rgba(201,168,76,0.25)",
        borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 2 }}>Notifications</p>
            <p style={{ fontSize: 11, color: "#444" }}>{notifications.length === 0 ? "Nothing yet" : `${notifications.length} total`}</p>
          </div>
          {notifications.length > 0 && (
            <button type="button" onClick={clearAll}
              style={{ fontSize: 11, color: "#555", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#888")}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>
              Clear all
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>◎</p>
              <p style={{ fontSize: 13, color: "#444" }}>No notifications yet</p>
              <p style={{ fontSize: 11, color: "#333", marginTop: 4 }}>Follow-up reminders and deal alerts will appear here</p>
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id}
                style={{ padding: "12px 16px", borderBottom: "1px solid #141414", background: n.read ? "transparent" : "rgba(201,168,76,0.03)", cursor: n.href ? "pointer" : "default" }}
                onClick={() => { markRead(n.id); if (n.href) { setOpen(false); window.location.href = n.href; } }}
                onMouseEnter={e => { if (n.href) (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? "transparent" : "rgba(201,168,76,0.03)"; }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 12, color: n.read ? "#444" : "#c9a84c", marginTop: 1, flexShrink: 0 }}>{typeIcon(n.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: n.read ? "#666" : "#c8c0b0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
                      {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9a84c", flexShrink: 0 }} />}
                    </div>
                    <p style={{ fontSize: 11, color: "#555", lineHeight: 1.4, marginBottom: 4 }}>{n.body}</p>
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
          <Link href="/settings#notifications" onClick={() => setOpen(false)}
            style={{ fontSize: 11, color: "#555", textDecoration: "none", display: "block", textAlign: "center" }}
            onMouseEnter={e => ((e.target as HTMLElement).style.color = "#888")}
            onMouseLeave={e => ((e.target as HTMLElement).style.color = "#555")}>
            Notification settings ⚙
          </Link>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={el => setBtnRef(el)}
        type="button"
        onClick={() => open ? setOpen(false) : (btnRef && openBell(btnRef))}
        aria-label="Notifications"
        style={{
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36, borderRadius: 8,
          border: "1px solid #252525", background: "#111", cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#8a6e30")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#252525")}
      >
        {/* Bell icon */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: "#c9a84c", color: "#080808",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", lineHeight: 1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {portal}
    </>
  );
}
