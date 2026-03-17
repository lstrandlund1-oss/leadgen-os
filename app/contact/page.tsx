"use client";

import { useState } from "react";
import Link from "next/link";
import HamburgerMenu from "../components/HamburgerMenu";

const SUBJECTS = [
  "General question",
  "Feature request",
  "Bug report",
  "Account or billing",
  "Partnership or integration",
  "Press enquiry",
  "Other",
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Try emailing us directly at hello@vantioapp.com");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
      <nav className="w-full border-b border-[#151515] bg-[#080808]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[#c9a84c]">◈</span>
            <Link href="/" className="text-[17px] font-light tracking-wide hover:opacity-80 transition-opacity" style={{ fontFamily: "var(--font-display), serif" }}>
              Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>tio</span>
            </Link>
            <span className="text-[9px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full border border-[rgba(201,168,76,0.25)] text-[#8a6e30]">Beta</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[12px] text-[#555] hover:text-[#888] transition-colors">← Dashboard</Link>
            <HamburgerMenu />
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl mx-auto w-full px-5 py-12">
        <div className="mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a6e30] mb-2">Contact</p>
          <h1 className="text-3xl md:text-4xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Get in <span className="italic" style={{ color: "#c9a84c" }}>touch</span>
          </h1>
          <p className="text-[13px] text-[#555] mt-2 max-w-md">Questions, feedback, or partnership enquiries — we read everything and reply within 1–2 business days.</p>
        </div>

        <div className="grid md:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Left — contact info */}
          <div className="space-y-3">
            {[
              { icon: "✉", label: "General enquiries", value: "hello@vantioapp.com", sub: "Questions, feedback, ideas" },
              { icon: "🛠", label: "Support", value: "hello@vantioapp.com", sub: "Bug reports and account issues" },
              { icon: "◈", label: "Partnerships", value: "hello@vantioapp.com", sub: "Integrations and collaborations" },
            ].map(({ icon, label, value, sub }) => (
              <div key={label} className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 flex items-start gap-4">
                <span className="text-lg mt-0.5 text-[#c9a84c]">{icon}</span>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#555] mb-0.5">{label}</p>
                  <p className="text-[13px] text-[#c8c0b0] font-medium">{value}</p>
                  <p className="text-[11px] text-[#444] mt-0.5">{sub}</p>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[#555]">Response time</p>
              <p className="text-[13px] text-[#c8c0b0] font-medium">1–2 business days</p>
              <p className="text-[11px] text-[#444]">During beta we&apos;re a small team. If something is urgent, mention it in your subject line.</p>
            </div>

            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-4 space-y-2.5">
              <p className="text-[10px] uppercase tracking-widest text-[#555]">Before you write</p>
              {[
                { label: "Account or billing issues", value: "hello@vantioapp.com" },
                { label: "Feature request", value: "Use the form →" },
                { label: "Found a bug", value: "hello@ with steps to reproduce" },
                { label: "Partnership or integration", value: "hello@vantioapp.com" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-[#555]">{label}</p>
                  <p className="text-[11px] text-[#444] text-right">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 space-y-5">
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-[#8a6e30] mb-1">Message</p>
              <h2 className="text-[15px] font-semibold text-[#c8c0b0]">Send a message</h2>
            </div>

            {submitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full border border-[#4ade80]/20 bg-[#4ade80]/05 flex items-center justify-center mx-auto text-2xl">✓</div>
                <p className="text-[14px] text-[#c8c0b0] font-medium">Message sent</p>
                <p className="text-[12px] text-[#555]">We&apos;ll get back to you at {form.email} within 1–2 business days.</p>
                <button type="button" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="text-[12px] text-[#c9a84c] hover:text-[#e8c97a] transition-colors mt-2">
                  Send another →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/05 px-4 py-3 text-[12px] text-rose-400">{error}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#666] mb-2">Name</label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your name"
                      className="w-full bg-[#080808] border border-[#252525] rounded-xl px-4 py-3 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.15em] text-[#666] mb-2">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      className="w-full bg-[#080808] border border-[#252525] rounded-xl px-4 py-3 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-[#666] mb-2">Subject</label>
                  <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full bg-[#080808] border border-[#252525] rounded-xl px-4 py-3 text-[13px] text-[#f5f0e8] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors">
                    <option value="">Select a subject…</option>
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-[#666] mb-2">Message</label>
                  <textarea rows={6} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Describe your question or issue in as much detail as possible…"
                    className="w-full bg-[#080808] border border-[#252525] rounded-xl px-4 py-3 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[rgba(201,168,76,0.5)] transition-colors resize-none" />
                </div>
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[#c9a84c] text-[#080808] font-semibold text-[14px] hover:bg-[#e8c97a] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                  {submitting ? "Sending…" : "Send message"}
                </button>
                <p className="text-[10px] text-[#333] text-center">We don&apos;t share your details with third parties.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#151515] py-6 px-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-[11px] text-[#333]">© {new Date().getFullYear()} Vantio</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-[11px] text-[#333] hover:text-[#555] transition-colors">Privacy</Link>
            <Link href="/terms" className="text-[11px] text-[#333] hover:text-[#555] transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
