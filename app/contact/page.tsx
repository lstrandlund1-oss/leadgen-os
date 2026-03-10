"use client";

import { useState } from "react";
import Link from "next/link";

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
      setError("Something went wrong. Try emailing us directly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080808] text-[#f5f0e8] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#252525]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#c9a84c]">◈</span>
          <span className="text-lg font-light tracking-wide" style={{ fontFamily: "var(--font-display), serif" }}>
            LeadGenOS
          </span>
        </Link>
        <Link href="/dashboard" className="text-[12px] text-[#666] hover:text-[#c8c0b0] transition-colors">
          ← Dashboard
        </Link>
      </nav>

      <main className="flex-1 px-6 md:px-12 py-12 max-w-5xl mx-auto w-full">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-widest text-[#c9a84c] mb-2">Contact</p>
          <h1 className="text-3xl font-light" style={{ fontFamily: "var(--font-display), serif" }}>
            Get in touch
          </h1>
          <p className="text-[#666] mt-2 text-sm">Questions, feedback, or partnership enquiries — we read everything.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* Contact info */}
          <div className="space-y-6">
            <div className="space-y-4">
              {[
                {
                  icon: "✉",
                  label: "General enquiries",
                  value: "hello@leadgenos.com",
                  sub: "For general questions and feedback",
                },
                {
                  icon: "🛠",
                  label: "Support",
                  value: "support@leadgenos.com",
                  sub: "Bug reports and account issues",
                },
              ].map(({ icon, label, value, sub }) => (
                <div key={label} className="rounded-xl border border-[#252525] bg-[#111] p-4 flex items-start gap-4">
                  <span className="text-lg mt-0.5">{icon}</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#555] mb-0.5">{label}</p>
                    <p className="text-[13px] text-[#c8c0b0] font-medium">{value}</p>
                    <p className="text-[11px] text-[#444] mt-0.5">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#252525] bg-[#111] p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widests text-[#555]">Response time</p>
              <p className="text-[13px] text-[#888]">We typically reply within <span className="text-[#c8c0b0]">1–2 business days</span>.</p>
              <p className="text-[11px] text-[#444] leading-relaxed">During beta we&apos;re a small team. If something is urgent, mention it in your subject line.</p>
            </div>

            <div className="rounded-xl border border-[#252525] bg-[#111] p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widests text-[#555]">Before you write</p>
              <div className="space-y-1.5">
                {[
                  { q: "Account or billing issues", a: "support@leadgenos.com" },
                  { q: "Feature request", a: "Use the form →" },
                  { q: "Partnership or integration", a: "hello@leadgenos.com" },
                  { q: "Found a bug", a: "support@ with steps to reproduce" },
                ].map(({ q, a }) => (
                  <div key={q} className="flex items-start justify-between gap-3">
                    <p className="text-[11px] text-[#555]">{q}</p>
                    <p className="text-[11px] text-[#777] text-right shrink-0">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-[#111111]/60 border border-[#252525] rounded-2xl p-6 space-y-4">
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-12">
                <div className="w-10 h-10 rounded-full border border-[#4ade80]/30 bg-[#4ade80]/8 flex items-center justify-center">
                  <span className="text-[#4ade80] text-lg">✓</span>
                </div>
                <p className="text-sm font-medium text-[#f5f0e8]">Message sent</p>
                <p className="text-[12px] text-[#555]">We&apos;ll get back to you within 1–2 business days.</p>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                  className="text-[11px] text-[#c9a84c] hover:text-[#e8c97a] mt-2 transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[11px] uppercase tracking-widests text-[#555]">Send a message</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widests text-[#555]">Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your name"
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widests text-[#555]">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="you@example.com"
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widests text-[#555]">Subject</label>
                  <select
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[13px] text-[#f5f0e8] focus:outline-none focus:border-[#c9a84c]/50 transition-colors"
                  >
                    <option value="">Select a subject…</option>
                    <option value="General enquiry">General enquiry</option>
                    <option value="Feature request">Feature request</option>
                    <option value="Bug report">Bug report</option>
                    <option value="Account / billing">Account / billing</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widests text-[#555]">Message</label>
                  <textarea
                    rows={5}
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Describe your question or issue in as much detail as possible…"
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-[13px] text-[#f5f0e8] placeholder-[#333] focus:outline-none focus:border-[#c9a84c]/50 transition-colors resize-none leading-relaxed"
                  />
                </div>
                {error && (
                  <p className="text-[12px] text-rose-400 px-1">{error}</p>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-[#c9a84c] text-[#080808] text-[13px] font-semibold hover:bg-[#e8c97a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? "Sending…" : "Send message"}
                </button>
                <p className="text-[10px] text-[#333] text-center">We don&apos;t share your details with third parties.</p>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1a1a1a] px-6 md:px-12 py-6 flex items-center justify-between">
        <p className="text-[11px] text-[#333]">© {new Date().getFullYear()} LeadGenOS</p>
        <div className="flex items-center gap-4">
          <Link href="/plans" className="text-[11px] text-[#333] hover:text-[#555] transition-colors">Pricing</Link>
          <Link href="/login" className="text-[11px] text-[#333] hover:text-[#555] transition-colors">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
