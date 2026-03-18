"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEffectivePlan, canUseOutreach } from "@/lib/plan";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

interface HamburgerMenuProps {
  userEmail?: string;
  hasProfile?: boolean;
}

export default function HamburgerMenu({
  language,
  userEmail,
}: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [btnPos, setBtnPos] = useState({ top: 16, left: 16 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const plan = getEffectivePlan();
  const outreachUnlocked = canUseOutreach(plan);

  function toggleMenu() {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      // Use clientWidth to avoid scrollbar/zoom inconsistencies
      setBtnPos({ top: r.top, left: r.left });
    }
    setOpen(o => !o);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const menuItems = [
    { label: "Home",             href: "/",           icon: "◇", locked: false },
    { label: "Dashboard",        href: "/dashboard",  icon: "◈", locked: false },
    { label: "Outreach",         href: "/outreach",   icon: "✦", locked: !outreachUnlocked },
    { label: "Profile",          href: "/profile",    icon: "◈", locked: false },
    { label: "Analytics",        href: "/analytics",  icon: "◉", locked: false },
    { label: "Follow-up Queue",  href: "/followups",  icon: "↩", locked: false },
    { label: "Import Leads",     href: "/import",     icon: "↑", locked: false },
    { label: "Settings",         href: "/settings",   icon: "⚙", locked: false },
    { label: "Contact & Support",href: "/contact",    icon: "✉", locked: false },
  ];

  // The portal renders the backdrop, the animated button clone, and the dropdown
  // All as direct children of document.body — guaranteed above everything
  const portal = (typeof window !== "undefined") && open ? createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, zIndex: 99997,
          background: "rgba(8,8,8,0.75)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
        aria-hidden="true"
      />

      {/* Close button — unicode ✕, always a perfect X */}
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close menu"
        style={{
          position: "fixed",
          top: btnPos.top,
          left: btnPos.left,
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          borderRadius: 8,
          border: "1px solid #8a6e30",
          background: "#111",
          cursor: "pointer",
          fontSize: 18,
          color: "#f5f0e8",
          lineHeight: 1,
          boxSizing: "border-box",
        }}
      >
        ✕
      </button>

      {/* Dropdown */}
      <div
        style={{
          position: "fixed",
          top: btnPos.top + 48,
          left: btnPos.left - 184,
          zIndex: 99998,
          width: 224,
          maxHeight: "80vh",
          overflowY: "auto",
          borderRadius: 12,
          border: "1px solid rgba(201,168,76,0.3)",
          background: "#111",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />

        {userEmail && (
          <>
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555", marginBottom: 2 }}>Signed in as</p>
              <p style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userEmail}</p>
            </div>
            <div style={{ height: 1, background: "#1a1a1a" }} />
          </>
        )}

        <div style={{ paddingTop: 8, paddingBottom: 8 }}>
          {menuItems.map((item, i) =>
            item.locked ? (
              <Link key={i} href="/plans" onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", fontSize: 14, color: "#555", textDecoration: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span style={{ fontSize: 11, color: "#3a3a3a" }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: 11 }}>🔒</span>
              </Link>
            ) : (
              <Link key={i} href={item.href} onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", fontSize: 14, color: "#f5f0e8", textDecoration: "none" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; (e.currentTarget as HTMLElement).style.color = "#e8c97a"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#f5f0e8"; }}>
                <span style={{ fontSize: 11, color: "#8a6e30" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          )}
        </div>



        <div style={{ height: 1, background: "#1a1a1a" }} />
        <button type="button" onClick={handleSignOut}
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", width: "100%", fontSize: 14, color: "#666", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#666"; }}>
          <span style={{ fontSize: 11, color: "#444" }}>⎋</span>
          <span>Sign Out</span>
        </button>

        <div style={{ height: 1, background: "#1a1a1a" }} />
        <div style={{ padding: "8px 16px" }}>
          <p style={{ fontSize: 10, color: "#333", letterSpacing: "0.1em", textTransform: "uppercase" }}>Vantio Beta</p>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      {/* Real button — visible when closed, hidden (but in DOM) when open so portal clone shows */}
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        style={{
          display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
          width: 40, height: 40, gap: 5, borderRadius: 8,
          border: "1px solid #252525", background: "#111", cursor: "pointer",
          transition: "border-color 0.2s",
          visibility: open ? "hidden" : "visible",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#8a6e30")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#252525")}
      >
        <span style={{ display: "block", width: 20, height: 1.5, background: "#f5f0e8" }} />
        <span style={{ display: "block", width: 20, height: 1.5, background: "#f5f0e8" }} />
        <span style={{ display: "block", width: 20, height: 1.5, background: "#f5f0e8" }} />
      </button>

      {portal}
    </>
  );
}
