"use client";
// cache-bust

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getEffectivePlan, canUseOutreach } from "@/lib/plan";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { useTheme } from "./ThemeProvider";

type Language = "en" | "sv";

interface HamburgerMenuProps {
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
  userEmail?: string;
  hasProfile?: boolean;
}

function ThemeToggleInline() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}
      className={"relative inline-flex h-5 w-9 items-center rounded-full border transition-colors " + (theme === "light" ? "bg-[rgba(184,148,46,0.2)] border-[#b8942e]" : "bg-[#111] border-[#252525]")}>
      <span className={"absolute h-3.5 w-3.5 rounded-full transition-transform " + (theme === "light" ? "translate-x-[18px] bg-[#b8942e]" : "translate-x-[3px] bg-[#444]")} />
    </button>
  );
}

export default function HamburgerMenu({
  language,
  onLanguageChange,
  userEmail,
}: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const plan = getEffectivePlan();
  const { theme } = useTheme();
  const outreachUnlocked = canUseOutreach(plan);

  // Measure button position for fixed dropdown placement
  function openMenu() {
    if (buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setOpen(true);
  }

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const target = e.target as Node;
      // Don't close if clicking inside the dropdown (handled by fixed portal)
      const dropdown = document.getElementById("vantio-hamburger-dropdown");
      if (dropdown && dropdown.contains(target)) return;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  async function handleSignOut() {
    setOpen(false);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const menuItems = [
    { label: "Home",             href: "/",            icon: "◇", locked: false },
    { label: "Dashboard",        href: "/dashboard",   icon: "◈", locked: false },
    { label: "Outreach",         href: "/outreach",    icon: "✦", locked: !outreachUnlocked },
    { label: "Profile",          href: "/profile",     icon: "◈", locked: false },
    { label: "Analytics",        href: "/analytics",   icon: "◉", locked: false },
    { label: "Follow-up Queue",  href: "/followups",   icon: "↩", locked: false },
    { label: "Import Leads",     href: "/import",      icon: "↑", locked: false },
    { label: "Settings",         href: "/settings",    icon: "⚙", locked: false },
    { label: "Contact & Support",href: "/contact",     icon: "✉", locked: false },
  ];

  // Dropdown right edge aligns with button right edge
  const dropdownRight = buttonRect ? window.innerWidth - buttonRect.right : 16;
  const dropdownTop = buttonRect ? buttonRect.bottom + 8 : 56;

  return (
    <>
      {/* Trigger button — no relative positioning needed */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => open ? setOpen(false) : openMenu()}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex flex-col justify-center items-center w-10 h-10 gap-[5px] rounded-lg border border-[#252525] bg-[#111] hover:border-[#8a6e30] transition-all duration-300"
      >
        <span className={`block w-5 h-[1.5px] bg-[#f5f0e8] transition-all duration-300 origin-center ${open ? "rotate-45 translate-y-[6.5px]" : ""}`} />
        <span className={`block w-5 h-[1.5px] bg-[#f5f0e8] transition-all duration-300 ${open ? "opacity-0 scale-x-0" : ""}`} />
        <span className={`block w-5 h-[1.5px] bg-[#f5f0e8] transition-all duration-300 origin-center ${open ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
      </button>

      {open && (
        <>
          {/* Full-viewport backdrop — fixed, blocks ALL page interaction */}
          <div
            className="fixed inset-0 bg-[#080808]/70 backdrop-blur-sm"
            style={{ zIndex: 9998 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown — fixed to viewport, always on top of everything */}
          <div
            id="vantio-hamburger-dropdown"
            className="fixed w-56 rounded-xl border border-[rgba(201,168,76,0.3)] bg-[#111] shadow-2xl overflow-hidden overflow-y-auto max-h-[80vh]"
            style={{ zIndex: 9999, top: dropdownTop, right: dropdownRight }}
          >
            <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent" />

            {userEmail && (
              <>
                <div className="px-4 py-3">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#555] mb-0.5">Signed in as</p>
                  <p className="text-[12px] text-[#888] truncate">{userEmail}</p>
                </div>
                <div className="h-[1px] w-full bg-[#1a1a1a]" />
              </>
            )}

            <div className="py-2">
              {menuItems.map((item, i) =>
                item.locked ? (
                  <Link key={i} href="/plans" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-[#555] hover:bg-[#1a1a1a] hover:text-[#888] transition-colors group">
                    <span className="text-[#3a3a3a] group-hover:text-[#555] transition-colors text-xs">{item.icon}</span>
                    <span className="tracking-wide flex-1">{item.label}</span>
                    <span className="text-[11px] text-[#444]" title="Operator+ only">🔒</span>
                  </Link>
                ) : (
                  <Link key={i} href={item.href} onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-[#f5f0e8] hover:bg-[#1a1a1a] hover:text-[#e8c97a] transition-colors group">
                    <span className="text-[#8a6e30] group-hover:text-[#c9a84c] transition-colors text-xs">{item.icon}</span>
                    <span className="tracking-wide">{item.label}</span>
                  </Link>
                )
              )}
            </div>

            {onLanguageChange && (
              <>
                <div className="h-[1px] w-full bg-[#252525]" />
                <div className="px-4 py-3">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[#555] mb-2">Language</p>
                  <div className="flex gap-2">
                    {(["en", "sv"] as const).map((lang) => (
                      <button key={lang} type="button"
                        onClick={() => { onLanguageChange(lang); setOpen(false); }}
                        className={`flex-1 py-1.5 rounded-md border text-[11px] uppercase tracking-wide transition-colors ${
                          language === lang
                            ? "border-[#c9a84c] bg-[rgba(201,168,76,0.1)] text-[#c9a84c]"
                            : "border-[#252525] text-[#555] hover:border-[#444]"
                        }`}>
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="h-[1px] w-full bg-[#252525]" />
            <div className="px-4 py-3 flex items-center justify-between">
              <p className="text-[11px] text-[#555]">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
              <ThemeToggleInline />
            </div>

            <div className="h-[1px] w-full bg-[#1a1a1a]" />
            <button type="button" onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 w-full text-sm text-[#666] hover:bg-[#1a1a1a] hover:text-rose-400 transition-colors group">
              <span className="text-[#444] group-hover:text-rose-500 transition-colors text-xs">⎋</span>
              <span className="tracking-wide">Sign Out</span>
            </button>

            <div className="h-[1px] w-full bg-[#1a1a1a]" />
            <div className="px-4 py-2">
              <p className="text-[10px] text-[#333] tracking-widest uppercase">Vantio Beta</p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
