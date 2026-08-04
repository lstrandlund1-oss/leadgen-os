"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabaseBrowser";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
};

const MAIN_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: "⌂" },
  { href: "/dashboard", label: "Lead Tool", icon: "◎" },
  { href: "/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/stats", label: "Stats", icon: "◫" },
  { href: "/ai-mode", label: "AI Mode", icon: "✦", disabled: true },
];

const WORKSPACE_NAV: NavItem[] = [
  { href: "/markets", label: "Markets", icon: "◐" },
  { href: "/outreach", label: "Outreach", icon: "➤" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/home" && pathname?.startsWith(href));
  }

  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 bg-[#080808] border-r border-[#1a1a1a] flex flex-col px-3 py-5">
      <div className="px-2 mb-8">
        <span className="text-[17px] tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
          <span className="text-[#c9a84c]">◆</span> Vantio
        </span>
      </div>

      <nav className="flex-1 space-y-0.5">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <p className="px-3 pt-6 pb-2 text-[10px] uppercase tracking-widest text-[#444]">Workspace</p>
        {WORKSPACE_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}

        <Link
          href="/settings"
          className={
            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors " +
            (isActive("/settings") ? "bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "text-[#888] hover:text-[#f5f0e8]")
          }>
          <span className="w-4 text-center text-[13px]">⚙</span>
          Settings
        </Link>
      </nav>

      <div className="pt-4 border-t border-[#1a1a1a] px-2">
        <p className="text-[12px] text-[#999] truncate">{email ?? "…"}</p>
        <button
          type="button"
          onClick={handleSignOut}
          className="text-[11px] text-[#555] hover:text-[#f87171] transition-colors mt-1">
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  if (item.disabled) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-[#444] cursor-not-allowed">
        <span className="w-4 text-center text-[13px]">{item.icon}</span>
        {item.label}
        <span className="ml-auto text-[9px] uppercase tracking-widest text-[#444]">Soon</span>
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      className={
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors " +
        (active ? "bg-[rgba(201,168,76,0.08)] text-[#c9a84c]" : "text-[#888] hover:text-[#f5f0e8]")
      }>
      <span className="w-4 text-center text-[13px]">{item.icon}</span>
      {item.label}
    </Link>
  );
}
