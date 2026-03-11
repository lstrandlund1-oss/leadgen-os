"use client";

import { useState, useEffect, useRef } from "react";

type Message = { role: "user" | "assistant"; content: string };

const WELCOME = "Hi — I'm the Vantio support bot. What can I help you with today?";

export default function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json() as { reply?: string; resolved?: boolean; needsHuman?: boolean };
      const reply = data.reply ?? "Something went wrong. Please try again.";
      const withReply: Message[] = [...next, { role: "assistant", content: reply }];
      setMessages(withReply);
      if (data.resolved || data.needsHuman) {
        setDone(true);
        const status = data.resolved ? "resolved" : "needs_human";
        fetch("/api/support-chat", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: withReply, status }),
        }).catch(() => {});
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Support chat"
        style={{
          position: "fixed", bottom: 80, right: 24, zIndex: 9999,
          width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #c9a84c 0%, #8a6e30 100%)",
          boxShadow: "0 8px 32px rgba(201,168,76,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="#080808" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M19 11C19 15.418 15.418 19 11 19C9.386 19 7.882 18.514 6.635 17.678L3 19L4.322 15.365C3.486 14.118 3 11.614 3 11C3 6.582 6.582 3 11 3C15.418 3 19 6.582 19 11Z" stroke="#080808" strokeWidth="1.8" strokeLinejoin="round"/>
            <circle cx="8" cy="11" r="1.2" fill="#080808"/>
            <circle cx="11" cy="11" r="1.2" fill="#080808"/>
            <circle cx="14" cy="11" r="1.2" fill="#080808"/>
          </svg>
        )}
      </button>

      {open && (
        <div style={{
          position: "fixed", bottom: 142, right: 24, zIndex: 9999,
          width: 340, height: 460, background: "#0d0d0d",
          border: "1px solid #1e1e1e", borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", background: "#111", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #c9a84c 0%, #8a6e30 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#080808", fontWeight: 700 }}>◈</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f5f0e8" }}>Support</div>
              <div style={{ fontSize: 10, color: "#555" }}>Vantio assistant</div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
                {m.role === "assistant" && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, fontSize: 8, color: "#c9a84c" }}>◈</div>
                )}
                <div style={{ maxWidth: "80%", padding: "8px 12px", fontSize: 12, lineHeight: 1.5, borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "4px 14px 14px 14px", background: m.role === "user" ? "rgba(201,168,76,0.12)" : "#141414", border: m.role === "user" ? "1px solid rgba(201,168,76,0.2)" : "1px solid #1e1e1e", color: m.role === "user" ? "#e8e0d0" : "#999" }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 8, color: "#c9a84c" }}>◈</div>
                <div style={{ padding: "10px 14px", background: "#141414", border: "1px solid #1e1e1e", borderRadius: "4px 14px 14px 14px", display: "flex", gap: 5, alignItems: "center" }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#555", display: "inline-block" }} />)}
                </div>
              </div>
            )}
            {done && (
              <div style={{ textAlign: "center", padding: "10px 14px", background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: "#c9a84c", marginBottom: 6 }}>✦ Ticket saved — our team will follow up.</p>
                <button onClick={() => { setMessages([{ role: "assistant", content: WELCOME }]); setDone(false); }}
                  style={{ fontSize: 10, color: "#555", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  New conversation
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!done && (
            <div style={{ padding: "10px 12px", borderTop: "1px solid #1a1a1a" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "#111", border: "1px solid #252525", borderRadius: 10, padding: "8px 10px" }}>
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 72) + "px"; }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Describe your issue…"
                  disabled={loading}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#c8c0b0", fontSize: 12, resize: "none", lineHeight: 1.5, maxHeight: 72, minHeight: 20, fontFamily: "inherit" }}
                />
                <button onClick={send} disabled={!input.trim() || loading}
                  style={{ width: 28, height: 28, borderRadius: 8, border: "none", cursor: "pointer", background: input.trim() && !loading ? "linear-gradient(135deg, #c9a84c 0%, #8a6e30 100%)" : "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: !input.trim() || loading ? 0.4 : 1 }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1 10L10 1M10 1H3M10 1V8" stroke="#080808" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p style={{ fontSize: 9, color: "#2a2a2a", textAlign: "center", marginTop: 6 }}>Enter to send · Shift+Enter for new line</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
