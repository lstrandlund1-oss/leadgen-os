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

type MenuItem =
  | {
      label: string;
      href: string;
      icon: string;
      locked: false;
    }
  | {
      label: string;
      href: null;
      icon: string;
      locked: true;
      soon: true; // coming soon — not a plan lock
    };

type MenuSection = {
  heading: string;
  items: MenuItem[];
};

export default function HamburgerMenu({ userEmail }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [btnPos, setBtnPos] = useState({ top: 16, left: 16 });
  const MENU_WIDTH = 256;
  const VIEWPORT_MARGIN = 12;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowser();
  const plan = getEffectivePlan();
  const outreachUnlocked = canUseOutreach(plan);

  function toggleMenu() {
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setBtnPos({ top: r.top, left: r.left });
    }
    setOpen((o) => !o);
  }

  // Dropdown anchors to the button's left edge minus its own width (so it
  // hangs down-left of the button, matching the original design intent),
  // but clamped so it can never render off-screen. The old fixed -220px
  // offset went negative whenever the button sat in the left half of a
  // narrow viewport — exactly what happens on a phone in portrait — which
  // pushed the whole menu out of view. On mobile, this now naturally
  // resolves to hugging the right edge of the screen instead.
  const dropdownLeft =
    typeof window !== "undefined"
      ? Math.min(Math.max(btnPos.left - 220, VIEWPORT_MARGIN), window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN)
      : btnPos.left - 220;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // ── Menu structure — full Vantio ecosystem ──────────────────────────────
  // Unlocked = live in beta. soon=true = coming soon, visible but locked.
  const sections: MenuSection[] = [
    {
      heading: "Core",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "◈", locked: false },
        { label: "Outreach", href: outreachUnlocked ? "/outreach" : "/plans", icon: "✦", locked: false },
        { label: "Follow-up Queue", href: "/followups", icon: "↩", locked: false },
        { label: "Collections", href: "/collections", icon: "◇", locked: false },
        { label: "Analytics", href: "/analytics", icon: "◉", locked: false },
      ],
    },
    {
      heading: "Intelligence",
      items: [
        { label: "Market Radar", href: null, icon: "⊕", locked: true, soon: true },
        { label: "Territory Globe", href: null, icon: "◎", locked: true, soon: true },
        { label: "Deal Angle Engine", href: null, icon: "◆", locked: true, soon: true },
        { label: "Objection Predictor", href: null, icon: "⟡", locked: true, soon: true },
      ],
    },
    {
      heading: "Engagement",
      items: [
        { label: "Sequence Builder", href: null, icon: "⇉", locked: true, soon: true },
        { label: "Channel Strategy", href: null, icon: "⊞", locked: true, soon: true },
        { label: "Reply Assistant", href: null, icon: "⌁", locked: true, soon: true },
      ],
    },
    {
      heading: "Conversion",
      items: [
        { label: "Offer Builder", href: null, icon: "◑", locked: true, soon: true },
        { label: "Proposal Generator", href: null, icon: "▤", locked: true, soon: true },
        { label: "Call Assistant", href: null, icon: "⌖", locked: true, soon: true },
      ],
    },
    {
      heading: "Delivery",
      items: [
        { label: "Fulfillment Blueprint", href: null, icon: "⊟", locked: true, soon: true },
        { label: "Asset Generator", href: null, icon: "⊞", locked: true, soon: true },
        { label: "ROI Tracker", href: null, icon: "⊿", locked: true, soon: true },
      ],
    },
    {
      heading: "Platform",
      items: [
        { label: "Import Leads", href: "/import", icon: "↑", locked: false },
        { label: "Pricing", href: "/plans", icon: "◈", locked: false },
        { label: "Profile", href: "/profile", icon: "◈", locked: false },
        { label: "Settings", href: "/profile/settings", icon: "⚙", locked: false },
        { label: "Contact & Support", href: "/contact", icon: "✉", locked: false },
      ],
    },
  ];

  const portal =
    typeof window !== "undefined" && open
      ? createPortal(
          <>
            {/* Backdrop */}
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 99997,
                background: "rgba(8,8,8,0.82)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              aria-hidden="true"
            />

            {/* Close button */}
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
              }}>
              ✕
            </button>

            {/* Dropdown */}
            <div
              data-vantio-menu="true"
              style={{
                position: "fixed",
                top: btnPos.top + 48,
                left: dropdownLeft,
                zIndex: 99998,
                width: 256,
                maxHeight: "82vh",
                overflowY: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "#2a2010 #0e0e0e",
                borderRadius: 14,
                border: "1px solid rgba(201,168,76,0.25)",
                background: "#0e0e0e",
                boxShadow: "0 30px 80px rgba(0,0,0,0.9)",
              }}>
              {/* Gold top line */}
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />

              {/* User email */}
              {userEmail && (
                <>
                  <div style={{ padding: "12px 16px" }}>
                    <p
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        color: "#444",
                        marginBottom: 2,
                      }}>
                      Signed in as
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#666",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                      {userEmail}
                    </p>
                  </div>
                  <div style={{ height: 1, background: "#1a1a1a" }} />
                </>
              )}

              {/* Sections */}
              {sections.map((section, si) => (
                <div key={si}>
                  {/* Section heading */}
                  <div style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                    <p
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        color: "#3a3a3a",
                        margin: 0,
                      }}>
                      {section.heading}
                    </p>
                    <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
                  </div>

                  {/* Items */}
                  {section.items.map((item, ii) =>
                    item.locked ? (
                      // Coming soon — not navigable, styled dimly with "soon" badge
                      <div
                        key={ii}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 16px",
                          fontSize: 13,
                          color: "#333",
                          cursor: "default",
                          userSelect: "none",
                        }}>
                        <span style={{ fontSize: 10, color: "#2a2a2a", width: 14, textAlign: "center" }}>
                          {item.icon}
                        </span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <span
                          style={{
                            fontSize: 8,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            color: "#4a3a1a",
                            border: "1px solid #2a2010",
                            borderRadius: 4,
                            padding: "1px 5px",
                          }}>
                          Soon
                        </span>
                      </div>
                    ) : (
                      <Link
                        key={ii}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 16px",
                          fontSize: 13,
                          color: "#c8c0b0",
                          textDecoration: "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#161616";
                          e.currentTarget.style.color = "#e8c97a";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "#c8c0b0";
                        }}>
                        <span style={{ fontSize: 10, color: "#6a5a30", width: 14, textAlign: "center" }}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    ),
                  )}

                  {/* Section divider (not after last section) */}
                  {si < sections.length - 1 && <div style={{ height: 1, background: "#141414", margin: "4px 0" }} />}
                </div>
              ))}

              {/* Footer — sign out + version */}
              <div style={{ height: 1, background: "#1a1a1a", marginTop: 4 }} />
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  width: "100%",
                  fontSize: 13,
                  color: "#444",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#161616";
                  e.currentTarget.style.color = "#f87171";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#444";
                }}>
                <span style={{ fontSize: 10, color: "#333", width: 14, textAlign: "center" }}>⎋</span>
                <span>Sign Out</span>
              </button>

              <div style={{ height: 1, background: "#141414" }} />
              <div
                style={{ padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p
                  style={{
                    fontSize: 9,
                    color: "#2a2a2a",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}>
                  Vantio
                </p>
                <p style={{ fontSize: 9, color: "#2a2a2a", letterSpacing: "0.08em", margin: 0 }}>Beta</p>
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: 40,
          height: 40,
          gap: 5,
          borderRadius: 8,
          border: "1px solid #252525",
          background: "#111",
          cursor: "pointer",
          transition: "border-color 0.2s",
          visibility: open ? "hidden" : "visible",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8a6e30")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#252525")}>
        <span style={{ display: "block", width: 20, height: 1.5, background: "#f5f0e8" }} />
        <span style={{ display: "block", width: 20, height: 1.5, background: "#f5f0e8" }} />
        <span style={{ display: "block", width: 20, height: 1.5, background: "#f5f0e8" }} />
      </button>

      {portal}
    </>
  );
}
