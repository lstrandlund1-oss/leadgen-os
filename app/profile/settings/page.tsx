"use client";

import Link from "next/link";
import HamburgerMenu from "../../components/HamburgerMenu";
import ProfilePage from "../ProfilePage";

export default function ProfileSettingsRoute() {
  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8]">

      {/* Nav */}
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link
              href="/"
              className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity"
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
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="text-[12px] text-[#555] hover:text-[#888] transition-colors tracking-wide flex items-center gap-1.5"
            >
              ← Profile
            </Link>
            <HamburgerMenu hasProfile={true} />
          </div>
        </div>
      </nav>

      {/* Page header */}
      <div className="max-w-4xl mx-auto px-5 pt-8 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/profile" className="text-[11px] text-[#555] hover:text-[#888] transition-colors">Profile</Link>
          <span className="text-[#333] text-[11px]">/</span>
          <span className="text-[11px] text-[#888]">Settings</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
          Profile <span className="italic" style={{ color: "#c9a84c" }}>Settings</span>
        </h1>
        <p className="text-[12px] text-[#555] mt-1">Configure your service profile, capabilities, and preferences.</p>
      </div>

      {/* Settings content */}
      <div className="max-w-4xl mx-auto px-5 py-6">
        <ProfilePage />
      </div>
    </div>
  );
}
