"use client";

import Link from "next/link";
import HamburgerMenu from "../components/HamburgerMenu";
import ProfilePage from "./ProfilePage";
import type { Language } from "@/lib/types";

export default function ProfileRoute() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="w-full border-b border-[#252525] bg-[#080808]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#c9a84c]">◈</span>
            <Link
              href="/"
              className="text-lg font-light tracking-wide hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              LeadGen
              <span style={{
                background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>OS</span>
            </Link>
            <span className="ml-2 text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.3)] text-[#8a6e30]">Beta</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-[12px] text-[#666] hover:text-[#888] transition-colors tracking-wide"
            >
              ← Back to Dashboard
            </Link>
            <HamburgerMenu hasProfile={true} />
          </div>
        </div>
      </nav>

      {/* Page header */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-2">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[#8a6e30] mb-1">Settings</p>
        <h1 className="text-2xl md:text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
          Your <span className="italic" style={{ color: "#c9a84c" }}>Profile</span>
        </h1>
      </div>

      {/* Profile content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <ProfilePage language={"en" as Language} />
      </div>
    </div>
  );
}
