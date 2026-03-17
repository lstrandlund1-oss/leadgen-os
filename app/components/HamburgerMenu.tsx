"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";
import { getEffectivePlan, canUseOutreach } from "@/lib/plan";

type HamburgerMenuProps = {
  hasProfile?: boolean;
  language?: string;
  onLanguageChange?: (lang: "en" | "sv") => void;
  userEmail?: string;
};

export default function HamburgerMenu({
  language,
  onLanguageChange,
  userEmail,
}: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const plan = getEffectivePlan();
  const outreachUnlocked = canUseOutreach(plan);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const menuItems = [
    { label: "Home",               href: "/",             icon: "◇",  locked: false },
    { label: "Dashboard",          href: "/dashboard",    icon: "◈",  locked: false },
    { label: "Outreach",           href: "/outreach",     icon: "✦",  locked: !outreachUnlocked },
    { label: "Profile",            href: "/profile",      icon: "◈",  locked: false },
    { label: "Analytics",          href: "/analytics",    icon: "◉",  locked: false },
  { label: "Follow-up Queue",    href: "/followups",    icon: "↩",  locked: false },
    { label: "Subscription Plans", href: "/plans",        icon: "◆",  locked: false },
    { label: "Contact & Support",  href: "/contact",      icon: "✉",  locked: false },
  { label: "Settings",           href: "/settings",     icon: "⚙",  locked: false },
  ];

  return (
    <>
      {/* Full-viewport backdrop — blocks all interaction with page behind */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#080808]/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <div ref={menuRef} className="relative z-50">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex flex-col justify-center items-center w-10 h-10 gap-[5px] rounded-lg border border-[#252525] bg-[#111] hover:border-[#8a6e30] transition-all duration-300"
        >
          <span className={`block w-5 h-[1.5px] bg-[#f5f0e8] transition-all duration-300 origin-center ${open ? "rotate-45 translate-y-[6.5px]" : ""}`} />
          <span className={`block w-5 h-[1.5px] bg-[#f5f0e8] transition-all duration-300 ${open ? "opacity-0 scale-x-0" : ""}`} />
          <span className={`block w-5 h-[1.5px] bg-[#f5f0e8] transition-all duration-300 origin-center ${open ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
        </button>

        {/* Dropdown — z-50 sits above the backdrop */}
        {open && (
          <div className="absolute right-0 mt-3 w-56 rounded-xl border border-[rgba(201,168,76,0.3)] bg-[#111] shadow-2xl overflow-hidden">
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
                  <Link
                    key={i}
                    href="/plans"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-[#555] hover:bg-[#1a1a1a] hover:text-[#888] transition-colors group"
                  >
                    <span className="text-[#3a3a3a] group-hover:text-[#555] transition-colors text-xs">{item.icon}</span>
                    <span className="tracking-wide flex-1">{item.label}</span>
                    <span className="text-[11px] text-[#444] group-hover:text-[#666] transition-colors" title="Operator+ only">🔒</span>
                  </Link>
                ) : (
                  <Link
                    key={i}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-[#f5f0e8] hover:bg-[#1a1a1a] hover:text-[#e8c97a] transition-colors group"
                  >
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
                      <button
                        key={lang}
                        type="button"
                        onClick={() => { onLanguageChange(lang); setOpen(false); }}
                        className={`flex-1 py-1.5 rounded-md border text-[11px] uppercase tracking-wide transition-colors ${
                          language === lang
                            ? "border-[#c9a84c] bg-[rgba(201,168,76,0.1)] text-[#c9a84c]"
                            : "border-[#252525] text-[#555] hover:border-[#444]"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="h-[1px] w-full bg-[#252525]" />
            <div className="py-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 w-full text-sm text-[#666] hover:bg-[#1a1a1a] hover:text-rose-400 transition-colors group"
              >
                <span className="text-[#444] group-hover:text-rose-500 transition-colors text-xs">⎋</span>
                <span className="tracking-wide">Sign Out</span>
              </button>
            </div>

            <div className="h-[1px] w-full bg-[#1a1a1a]" />
            <div className="px-4 py-2">
              <p className="text-[10px] text-[#333] tracking-widest uppercase">Vantio Beta</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
