"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import HamburgerMenu from "./components/HamburgerMenu";

const FEATURES = [
  { icon: "◈", title: "Signal-Driven Scoring", body: "Every lead is scored across opportunity, readiness, risk, and fit — not just star ratings. Know exactly why a business is worth your time." },
  { icon: "◆", title: "Matched to Your Service", body: "Your profile shapes every score. A web developer sees different leads than an SEO specialist — same database, completely different intelligence." },
  { icon: "✦", title: "Outreach Built In", body: "Every lead comes with a tailored pitch angle, gap analysis, and an AI-generated message — written around your offer and the lead's specific signals." },
  { icon: "◇", title: "Enriched Automatically", body: "Website reachability, booking CTAs, social presence, mobile friendliness — all scanned and factored into the score the moment you open a lead." },
  { icon: "⬡", title: "Track Your Pipeline", body: "Mark leads as contacted, replied, booked, closed. See your conversion rates across every stage. Revenue totals auto-calculated." },
  { icon: "◉", title: "Geography Aware", body: "Set your target location once. Every fit score adjusts for proximity — leads in your market surface first, automatically." },
];

const STEPS = [
  { number: "01", title: "Set your profile", body: "Tell Vantio what you offer and who you serve. Your profile becomes the lens every score is seen through." },
  { number: "02", title: "Search for leads", body: "Enter a niche and location. The engine pulls local businesses and scores each one against your capabilities in seconds." },
  { number: "03", title: "Read the intelligence", body: "Opportunity score, risk profile, website signals, gap type, fit score, and a personalised pitch angle — not just a name and phone number." },
  { number: "04", title: "Reach out with confidence", body: "Save promising leads, generate a personalised AI message in seconds, send it, track the outcome. Your pipeline builds itself." },
];

// Each stat has: display value, a numeric target for count-up (null = non-numeric),
// prefix/suffix for formatting, and a label
const STATS = [
  { display: "< 3s", countTo: 3, prefix: "< ", suffix: "s", label: "Average time to score a lead", hint: "vs. 45+ min of manual research" },
  { display: "4", countTo: 4, prefix: "", suffix: "", label: "Gap types detected automatically", hint: "Visibility, Conversion, Infrastructure, Optimisation" },
  { display: "AI", countTo: null, prefix: "", suffix: "", label: "Messages written to your offer", hint: "Tailored to each lead's signals" },
  { display: "100%", countTo: 100, prefix: "", suffix: "%", label: "Profile-matched — no generic lists", hint: "Every score shaped by your profile" },
];

// Easing function for count-up
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function StatBar() {
  const [triggered, setTriggered] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  const sectionRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); }
    if (!node) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setCounts([0, 0, 0, 0]);   // reset BEFORE triggering so count-up starts fresh
        setTriggered(true);
        setShimmer(false);
        setTimeout(() => setShimmer(true), 200);
      } else {
        // Reset trigger/shimmer so it replays, but keep counts at final value
        // to avoid flash of "< 0s" while scrolling back
        setTriggered(false);
        setShimmer(false);
        // counts stay at final values until next trigger resets them
      }
    }, { threshold: 0.3 });
    observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    if (!triggered) return;
    const duration = 3200;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);

      setCounts(STATS.map(s =>
        s.countTo !== null ? Math.round(eased * s.countTo) : 0
      ));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [triggered]);

  const displayValue = (s: typeof STATS[0], i: number) => {
    if (s.countTo === null) return s.display;
    // Always show prefix+count+suffix during active animation
    // Show final display string when not yet triggered or count just reset to 0
    if (!triggered) return s.display;
    if (counts[i] === 0) return s.display; // count hasn't started yet
    return `${s.prefix}${counts[i]}${s.suffix}`;
  };

  return (
    <section ref={sectionRef} style={{ borderTop: "1px solid #141414", borderBottom: "1px solid #141414", background: "#0a0a0a", position: "relative", overflow: "hidden" }}>
      {/* Shimmer sweep line */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, width: "60px",
        background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)",
        left: shimmer ? "110%" : "-10%",
        transition: shimmer ? "left 1.2s cubic-bezier(0.4,0,0.2,1)" : "none",
        pointerEvents: "none", zIndex: 2,
      }} />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", position: "relative" }}>
        {STATS.map((s, i) => (
          <div key={i} style={{ textAlign: "center", position: "relative", padding: "8px 16px" }}>
            {/* Vertical divider — not on last item */}
            {i < 3 && (
              <div style={{
                position: "absolute", right: 0, top: "10%", bottom: "10%", width: 1,
                background: `linear-gradient(to bottom, transparent, rgba(201,168,76,${shimmer ? 0.15 : 0}), transparent)`,
                transition: "background 0.8s ease 0.4s",
              }} />
            )}

            {/* Count-up number */}
            <p style={{
              fontFamily: "var(--font-display), serif",
              fontSize: "clamp(28px,4vw,44px)",
              fontWeight: 300, marginBottom: 6,
              background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 60%, #8a6e30 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              opacity: triggered ? 1 : 0,
              transform: triggered ? "translateY(0)" : "translateY(12px)",
              transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms`,
              fontVariantNumeric: "tabular-nums",
            }}>
              {displayValue(s, i)}
            </p>

            {/* Label */}
            <p style={{
              fontSize: 11, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase",
              opacity: triggered ? 1 : 0,
              transition: `opacity 0.6s ease ${i * 120 + 200}ms`,
            }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <style>{`

      `}</style>
    </section>
  );
}

const MOCK_LEAD = {
  name: "Bloom & Co Studio", industry: "Beauty Salon", city: "London",
  score: 74, fit: 81, opportunity: 68, risk: 22,
  gap: "CONVERSION", gapColor: "#fb923c", verdict: "Strong Lead", verdictColor: "#4ade80",
};

// Orbital feature chips — positioned around the card
const ORBITAL_CHIPS = [
  { icon: "◈", label: "Signal Scoring", sub: "4 dimensions", color: "#c9a84c", angle: -140, radius: 230, driftSpeed: 0.018, delay: 900 },
  { icon: "✦", label: "Outreach Built In", sub: "AI-generated", color: "#818cf8", angle: -35, radius: 260, driftSpeed: 0.013, delay: 1100 },
  { icon: "⬡", label: "Pipeline Tracking", sub: "All stages", color: "#4ade80", angle: 145, radius: 240, driftSpeed: 0.020, delay: 1300 },
  { icon: "◆", label: "Fit Matching", sub: "Profile-tuned", color: "#fb923c", angle: 40, radius: 250, driftSpeed: 0.015, delay: 1500 },
  { icon: "◉", label: "Deep Scanning", sub: "Auto-enriched", color: "#f472b6", angle: 95, radius: 260, driftSpeed: 0.011, delay: 1700 },
];

function useReveal(): [(node: HTMLDivElement | null) => void, boolean] {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const callbackRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (!node) return;
    observerRef.current = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observerRef.current?.disconnect(); }
    }, { threshold: 0.12 });
    observerRef.current.observe(node);
  }, []);
  return [callbackRef, visible];
}


// Each feature card tracks mouse position to render a spotlight glow
function FeatureCard({ f, i, visible }: { f: typeof FEATURES[0]; i: number; visible: boolean }) {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const ICON_COLORS = ["#c9a84c", "#818cf8", "#4ade80", "#fb923c", "#f472b6", "#60a5fa"];
  const iconColor = ICON_COLORS[i % ICON_COLORS.length];

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMouse(null); }}
      style={{
        padding: 28, borderRadius: 18, position: "relative", overflow: "hidden",
        border: `1px solid ${hovered ? "rgba(201,168,76,0.35)" : "#151515"}`,
        background: hovered ? "#111" : "#0d0d0d",
        opacity: visible ? 1 : 0,
        transform: visible
          ? hovered ? "translateY(-4px) scale(1.01)" : "none"
          : "translateY(40px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms, transform 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.3s ease, background 0.3s ease`,
        boxShadow: hovered
          ? "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)"
          : "none",
        cursor: "default",
      }}
    >
      {/* Mouse-tracked spotlight glow */}
      {mouse && (
        <div style={{
          position: "absolute",
          left: mouse.x - 120, top: mouse.y - 120,
          width: 240, height: 240,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(201,168,76,0.10) 0%, transparent 70%)`,
          pointerEvents: "none",
          transition: "none",
        }} />
      )}

      {/* Top-edge gold line that appears on hover */}
      <div style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
        background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)`,
        opacity: hovered ? 0.6 : 0,
        transition: "opacity 0.3s ease",
      }} />

      {/* Icon */}
      <div style={{
        fontSize: 22, marginBottom: 18,
        color: hovered ? iconColor : "#8a7a4a",
        transform: hovered ? "scale(1.25) translateY(-1px)" : "scale(1)",
        transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
        display: "inline-block",
        filter: hovered ? `drop-shadow(0 0 8px ${iconColor}60)` : "none",
      }}>
        {f.icon}
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "var(--font-display), serif", fontSize: 18, fontWeight: 500,
        marginBottom: 10,
        color: hovered ? "#f5f0e8" : "#e8e0d0",
        transition: "color 0.3s ease",
      }}>
        {f.title}
      </h3>

      {/* Body */}
      <p style={{
        fontSize: 13, lineHeight: 1.7,
        color: hovered ? "#666" : "#555",
        transition: "color 0.3s ease",
      }}>
        {f.body}
      </p>
    </div>
  );
}



const STEP_COLORS_LIST = ["#c9a84c", "#818cf8", "#4ade80", "#f472b6"];

// Individual step card — flashes when its pipeline node is active
function StepCard({ s, i, visible, nodeActive, nodeGlow = 0 }: {
  s: typeof STEPS[0]; i: number; visible: boolean; nodeActive: boolean; nodeGlow?: number;
}) {
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const accent = STEP_COLORS_LIST[i];

  return (
    <div
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMouse(null); }}
      style={{
        display: "flex", gap: 28, padding: 32,
        borderRadius: 18, position: "relative", overflow: "hidden",
        border: `1px solid ${hovered ? accent + "40" : nodeGlow > 0.05 ? accent + Math.round(nodeGlow * 80).toString(16).padStart(2,"0") : "#151515"}`,
        background: hovered ? "#0f0f0f" : nodeGlow > 0.05 ? accent + "08" : "#0a0a0a",
        opacity: visible ? 1 : 0,
        transform: visible
          ? (hovered ? "translateX(4px)" : "none")
          : "translateY(30px)",
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 120}ms,
          transform 0.35s cubic-bezier(0.16,1,0.3,1),
          border-color 0.4s ease,
          background 0.4s ease`,
        boxShadow: nodeActive
          ? `0 0 30px ${accent}12, 0 8px 32px rgba(0,0,0,0.4)`
          : hovered ? `0 8px 32px rgba(0,0,0,0.4)` : "none",
        cursor: "default",
      }}
    >
      {/* Mouse spotlight */}
      {mouse && (
        <div style={{
          position: "absolute",
          left: mouse.x - 120, top: mouse.y - 120,
          width: 240, height: 240, borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`,
          pointerEvents: "none", transition: "none",
        }} />
      )}

      {/* Left accent flash on node active */}
      <div style={{
        position: "absolute", left: 0, top: "15%", bottom: "15%", width: 2,
        background: `linear-gradient(to bottom, transparent, ${accent}, transparent)`,
        opacity: nodeGlow > 0.05 ? nodeGlow * 0.8 : hovered ? 0.3 : 0,
        transition: "opacity 0.4s ease",
        borderRadius: 2,
      }} />

      {/* Step number */}
      <div style={{ flexShrink: 0, width: 64, display: "flex", alignItems: "flex-start", justifyContent: "flex-start", paddingTop: 4 }}>
        <span style={{
          fontFamily: "var(--font-display), serif",
          fontSize: 52, fontWeight: 300, lineHeight: 1,
          color: nodeGlow > 0.1 ? accent : hovered ? accent + "cc" : "#222",
          transition: "color 0.15s ease, filter 0.15s ease",
          filter: nodeGlow > 0.1 ? `drop-shadow(0 0 ${Math.round(nodeGlow * 12)}px ${accent}${Math.round(nodeGlow * 100).toString(16).padStart(2,"0")})` : "none",
        }}>
          {s.number}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        <h3 style={{
          fontFamily: "var(--font-display), serif", fontSize: 19, fontWeight: 500,
          marginBottom: 10,
          color: nodeActive ? "#f5f0e8" : hovered ? "#f5f0e8" : "#e8e0d0",
          transition: "color 0.3s ease",
        }}>
          {s.title}
        </h3>
        <p style={{
          fontSize: 13, lineHeight: 1.75,
          color: hovered ? "#666" : "#555",
          transition: "color 0.3s ease",
        }}>
          {s.body}
        </p>
      </div>
    </div>
  );
}

function StepsSection({ visible, scrollY }: { visible: boolean; scrollY: number }) {
  // Scroll-driven: section starts entering view ~scrollY 1400, fully exits ~3400
  // Map scrollY to t: 0→1 across a 1600px scroll window starting when section enters
  const SCROLL_START = 1693;  // when step 2 is fully visible
  const SCROLL_RANGE = 900;   // complete animation in 900px of scroll (fast, all within visible window)
  const t = visible
    ? Math.max(0, Math.min(1, (scrollY - SCROLL_START) / SCROLL_RANGE))
    : 0;

  // Smooth node value 0.0–3.0 — used for continuous fade in/out glow
  const smoothNode = t * 3;

  // Vertical pipeline: runs down left side, 4 nodes evenly spaced
  // ViewBox: 80 wide × 600 tall. Nodes at y = 75, 225, 375, 525 (x=40)
  const NODE_Y = [75, 225, 375, 525];
  const NODE_X = 40;
  const TOTAL_H = 600;

  // Pulse Y position travels top → bottom
  const pulseY = t * (NODE_Y[3] - NODE_Y[0]) + NODE_Y[0];
  // Trail: last 12% of the path behind the pulse
  const trailY = Math.max(NODE_Y[0], pulseY - 0.12 * (NODE_Y[3] - NODE_Y[0]));

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "stretch", position: "relative" }}>

      {/* Vertical pipeline SVG — left column */}
      <div style={{
        width: 80, flexShrink: 0,
        opacity: visible ? 1 : 0,
        transition: "opacity 1s ease 0.4s",
        position: "relative",
      }}>
        <svg viewBox={`0 0 80 ${TOTAL_H}`} style={{ width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid meet">
          <defs>
            <filter id="pipeGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="dotGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="trailGrad" x1="0" x2="0" y1={trailY} y2={pulseY} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(201,168,76,0)" />
              <stop offset="100%" stopColor="rgba(201,168,76,0.7)" />
            </linearGradient>
          </defs>

          {/* Pipe outer glow */}
          <line x1={NODE_X} y1={NODE_Y[0]} x2={NODE_X} y2={NODE_Y[3]}
            stroke="rgba(201,168,76,0.08)" strokeWidth="12" filter="url(#pipeGlow)" />

          {/* Pipe body — dark tube */}
          <line x1={NODE_X} y1={NODE_Y[0]} x2={NODE_X} y2={NODE_Y[3]}
            stroke="#0d0d0d" strokeWidth="6" />

          {/* Pipe wall — thin gold lines either side */}
          <line x1={NODE_X - 3} y1={NODE_Y[0]} x2={NODE_X - 3} y2={NODE_Y[3]}
            stroke="rgba(201,168,76,0.18)" strokeWidth="1" />
          <line x1={NODE_X + 3} y1={NODE_Y[0]} x2={NODE_X + 3} y2={NODE_Y[3]}
            stroke="rgba(201,168,76,0.18)" strokeWidth="1" />

          {/* Glowing trail behind pulse */}
          <line
            x1={NODE_X} y1={trailY}
            x2={NODE_X} y2={pulseY}
            stroke="url(#trailGrad)"
            strokeWidth="4"
          />

          {/* Node indicators — smooth glow based on pulse proximity */}
          {NODE_Y.map((ny, i) => {
            const dist = Math.abs(smoothNode - i);
            const glow = Math.max(0, 1 - dist * 1.8);
            const ripple = Math.max(0, 1 - dist * 3.0);
            const color = STEP_COLORS_LIST[i];
            return (
              <g key={i}>
                {/* Ripple ring — expands and fades as pulse arrives */}
                <circle cx={NODE_X} cy={ny} r={10 + glow * 10}
                  fill="none" stroke={color} strokeWidth="1"
                  opacity={ripple * 0.35}
                />
                {/* Connector tick to card */}
                <line x1={NODE_X + 8} y1={ny} x2={76} y2={ny}
                  stroke={color} strokeWidth="1"
                  opacity={0.12 + glow * 0.7}
                />
                {/* Node ring */}
                <circle cx={NODE_X} cy={ny} r="8"
                  fill={color} fillOpacity={glow * 0.22}
                  stroke={color} strokeWidth="1.5"
                  opacity={0.25 + glow * 0.75}
                />
                {/* Centre dot — grows with glow */}
                <circle cx={NODE_X} cy={ny} r={2 + glow * 2}
                  fill={color} opacity={0.35 + glow * 0.65}
                  filter={glow > 0.2 ? "url(#pipeGlow)" : "none"}
                />
              </g>
            );
          })}

          {/* Pulse dot */}
          <circle cx={NODE_X} cy={pulseY} r="10"
            fill="rgba(201,168,76,0.1)"
            filter="url(#dotGlow)"
          />
          <circle cx={NODE_X} cy={pulseY} r="4"
            fill="#e8c97a"
            filter="url(#dotGlow)"
          />
        </svg>
      </div>

      {/* Cards — stacked vertically, full order guaranteed */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {STEPS.map((s, i) => {
          const dist = Math.abs(smoothNode - i);
          const glow = Math.max(0, 1 - dist * 1.8);
          return (
            <StepCard key={i} s={s} i={i} visible={visible}
              nodeActive={glow > 0.1}
              nodeGlow={glow}
            />
          );
        })}
      </div>
    </div>
  );
}


function ScoreBar({ label, value, color, delay = 0, animate }: { label: string; value: number; color: string; delay?: number; animate: boolean }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setWidth(value), delay);
    return () => clearTimeout(t);
  }, [animate, value, delay]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
        <span style={{ color: "#555" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ width: "100%", height: 6, background: "#1a1a1a", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${width}%`, height: "100%", background: color, borderRadius: 999, transition: "width 1.2s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );
}

// ── SEQUENCE DATA ──
// Each cycle has a matching search query + results set
const SEARCH_CYCLES = [
  {
    query: "beauty salons · london",
    leads: [
      { name: "Bloom & Co Studio",    industry: "Beauty Salon",   city: "London",  score: 74, fit: 81, opp: 68, risk: 22, gap: "CONVERSION",     gapColor: "#fb923c", verdict: "Strong Lead", verdictColor: "#4ade80" },
      { name: "Glow Beauty Bar",      industry: "Beauty Salon",   city: "London",  score: 61, fit: 70, opp: 55, risk: 30, gap: "VISIBILITY",      gapColor: "#818cf8", verdict: "Good Lead",   verdictColor: "#c9a84c" },
      { name: "Luxe Nail & Spa",      industry: "Beauty Salon",   city: "London",  score: 88, fit: 92, opp: 85, risk: 10, gap: "CONVERSION",     gapColor: "#fb923c", verdict: "Top Lead",    verdictColor: "#4ade80" },
      { name: "The Beauty Collective",industry: "Beauty Salon",   city: "London",  score: 45, fit: 38, opp: 50, risk: 55, gap: "OPTIMISATION",   gapColor: "#f472b6", verdict: "Weak Lead",   verdictColor: "#f87171" },
      { name: "Studio Muse London",   industry: "Beauty Salon",   city: "London",  score: 79, fit: 84, opp: 74, risk: 18, gap: "INFRASTRUCTURE", gapColor: "#60a5fa", verdict: "Strong Lead", verdictColor: "#4ade80" },
    ],
  },
  {
    query: "web design agencies · stockholm",
    leads: [
      { name: "Norr Studio AB",       industry: "Web Agency",     city: "Stockholm", score: 82, fit: 88, opp: 79, risk: 14, gap: "CONVERSION",     gapColor: "#fb923c", verdict: "Top Lead",    verdictColor: "#4ade80" },
      { name: "Pixel & Pine",         industry: "Web Agency",     city: "Stockholm", score: 67, fit: 60, opp: 72, risk: 28, gap: "VISIBILITY",      gapColor: "#818cf8", verdict: "Good Lead",   verdictColor: "#c9a84c" },
      { name: "Forma Digital",        industry: "Web Agency",     city: "Stockholm", score: 55, fit: 50, opp: 61, risk: 40, gap: "OPTIMISATION",   gapColor: "#f472b6", verdict: "Weak Lead",   verdictColor: "#f87171" },
      { name: "Brightpath Agency",    industry: "Web Agency",     city: "Stockholm", score: 91, fit: 95, opp: 88, risk: 8,  gap: "INFRASTRUCTURE", gapColor: "#60a5fa", verdict: "Top Lead",    verdictColor: "#4ade80" },
      { name: "Studio Noll",          industry: "Web Agency",     city: "Stockholm", score: 73, fit: 77, opp: 68, risk: 22, gap: "CONVERSION",     gapColor: "#fb923c", verdict: "Strong Lead", verdictColor: "#4ade80" },
    ],
  },
  {
    query: "personal trainers · manchester",
    leads: [
      { name: "Peak Form PT",         industry: "Personal Trainer", city: "Manchester", score: 86, fit: 90, opp: 83, risk: 12, gap: "VISIBILITY",      gapColor: "#818cf8", verdict: "Top Lead",    verdictColor: "#4ade80" },
      { name: "Iron & Grit Fitness",  industry: "Personal Trainer", city: "Manchester", score: 62, fit: 58, opp: 66, risk: 34, gap: "CONVERSION",     gapColor: "#fb923c", verdict: "Good Lead",   verdictColor: "#c9a84c" },
      { name: "Elevate Coaching",     industry: "Personal Trainer", city: "Manchester", score: 77, fit: 82, opp: 73, risk: 20, gap: "OPTIMISATION",   gapColor: "#f472b6", verdict: "Strong Lead", verdictColor: "#4ade80" },
      { name: "Body Blueprint",       industry: "Personal Trainer", city: "Manchester", score: 49, fit: 42, opp: 55, risk: 50, gap: "INFRASTRUCTURE", gapColor: "#60a5fa", verdict: "Weak Lead",   verdictColor: "#f87171" },
      { name: "Momentum Fitness MCR", industry: "Personal Trainer", city: "Manchester", score: 80, fit: 85, opp: 76, risk: 16, gap: "CONVERSION",     gapColor: "#fb923c", verdict: "Strong Lead", verdictColor: "#4ade80" },
    ],
  },
];

// Keep a flat MOCK_LEADS for TypeScript — replaced dynamically
const MOCK_LEADS = SEARCH_CYCLES[0].leads;

// Animated typing text
function TypedText({ text, started }: { text: string; started: boolean }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!started) { setDisplayed(""); return; }
    let i = 0;
    setDisplayed("");
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, 55);
    return () => clearInterval(iv);
  }, [started, text]);
  return <>{displayed}<span style={{ opacity: displayed.length < text.length ? 1 : 0, transition: "opacity 0.1s" }}>|</span></>;
}

// Mini score bar for the expanded card
function MiniBar({ label, value, color, animate, delay }: { label: string; value: number; color: string; animate: boolean; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!animate) {
      const t = setTimeout(() => setW(0), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [animate, value, delay]);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 3 }}>
        <span style={{ color: "#555" }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "#1a1a1a", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 999, transition: "width 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
    </div>
  );
}

// Stage durations in ms
const STAGE_SEARCH   = 1600;  // typing
const STAGE_RESULTS  = 2200;  // results cascade in
const STAGE_SCORE    = 3200;  // selected card expands + scores
const STAGE_PAUSE    = 1000;  // hold before reset
const TOTAL_CYCLE    = STAGE_SEARCH + STAGE_RESULTS + STAGE_SCORE + STAGE_PAUSE;

// ── GOLD FIELD — breathing layered radial gradient ──
// Multiple gold orbs drift independently, creating organic ambient glow behind headline
// ── HERO TEXT — breathing gold field + mouse parallax depth ──
function HeroText({ scrollY, heroTextOpacity, waitlistCount }: {
  scrollY: number; heroTextOpacity: number; waitlistCount: number | null;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 }); // -1 to 1 from centre
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Normalise to -1..1 from viewport centre
      setMouse({
        x: (e.clientX - vw / 2) / (vw / 2),
        y: (e.clientY - vh / 2) / (vh / 2),
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Line 1 moves gently, line 2 moves at 1.8x — creates Z-depth separation
  const line1X = mouse.x * 10;
  const line1Y = mouse.y * 5;
  const line2X = mouse.x * 18;
  const line2Y = mouse.y * 9;

  return (
    <div
      ref={wrapRef}
      style={{
        opacity: heroTextOpacity,
        transform: `translateY(${scrollY * -0.04}px)`,
        transition: "opacity 0.05s linear",
        pointerEvents: heroTextOpacity < 0.05 ? "none" : "auto",
        width: "100%", textAlign: "center",
        position: "relative", zIndex: 10, marginBottom: 48,
      }}
    >
      {/* Headline with breathing gold field + per-line parallax */}
      <div className="animate-fade-up-delay-2" style={{ position: "relative", display: "inline-block", maxWidth: 960, width: "100%", margin: "0 auto 20px" }}>
        {/* Breathing gold field sits behind both lines */}
        <GoldField />

        {/* Line 1 — left-anchored, lighter parallax */}
        <div style={{
          position: "relative", zIndex: 1,
          transform: `translate(${line1X}px, ${line1Y}px)`,
          transition: "transform 0.08s ease-out",
          display: "block",
          textAlign: "left",
          paddingLeft: "6%",
        }}>
          <span style={{
            fontFamily: "var(--font-display), serif",
            fontSize: "clamp(38px, 6vw, 72px)",
            fontWeight: 300, lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#f5f0e8",
            display: "block",
          }}>
            The intelligence layer
          </span>
        </div>

        {/* Line 2 — staggered right, heavier parallax, italic gold */}
        <div style={{
          position: "relative", zIndex: 1,
          transform: `translate(${line2X}px, ${line2Y}px)`,
          transition: "transform 0.08s ease-out",
          display: "block",
          textAlign: "right",
          paddingRight: "6%",
        }}>
          <em style={{
            fontFamily: "var(--font-display), serif",
            fontSize: "clamp(38px, 6vw, 72px)",
            fontWeight: 600, lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontStyle: "italic",
            background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            display: "block",
          }}>
            your outreach is missing.
          </em>
        </div>
      </div>

      <p className="animate-fade-up-delay-3" style={{ fontSize: 15, color: "#666", maxWidth: 500, margin: "0 auto 32px", lineHeight: 1.7 }}>
        Vantio finds local businesses and tells you exactly which ones are worth contacting — scored against your service, capability, and style.
      </p>
      <div className="animate-fade-up-delay-4" style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
        <GlowButton href="/login" style={{ padding: "13px 28px", borderRadius: 10, background: "#c9a84c", color: "#080808", fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", textDecoration: "none", boxShadow: "0 8px 40px rgba(201,168,76,0.22)" }}>
          Request Early Access
        </GlowButton>
        <Link href="#how-it-works" style={{ fontSize: 13, color: "#555", textDecoration: "none", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8 }}>
          See how it works <span style={{ color: "#8a6e30" }}>↓</span>
        </Link>
      </div>
    </div>
  );
}


function GoldField() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number;
    const tick = (now: number) => {
      if (!start) start = now;
      setT((now - start) / 1000); // seconds
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 5 orbs, each with unique frequency, amplitude and phase
  const orbs = [
    { cx: 50 + Math.sin(t * 0.17) * 12,      cy: 38 + Math.cos(t * 0.13) * 8,   r: 42, opacity: 0.18, color: "#c9a84c" },
    { cx: 42 + Math.cos(t * 0.11) * 16,      cy: 35 + Math.sin(t * 0.19) * 10,  r: 30, opacity: 0.11, color: "#e8c97a" },
    { cx: 58 + Math.sin(t * 0.23 + 1.2) * 14,cy: 34 + Math.cos(t * 0.09) * 12,  r: 24, opacity: 0.12, color: "#c9a84c" },
    { cx: 50 + Math.cos(t * 0.07 + 2.1) * 20, cy: 52 + Math.sin(t * 0.15) * 7,  r: 32, opacity: 0.07, color: "#8a6e30" },
    { cx: 48 + Math.sin(t * 0.31 + 0.5) * 10, cy: 46 + Math.cos(t * 0.21) * 14, r: 18, opacity: 0.11, color: "#e8c97a" },
  ];

  return (
    <div style={{
      position: "absolute",
      left: "50%", top: "50%",
      transform: "translate(-50%, -50%)",
      width: "140%", height: "280%",
      pointerEvents: "none",
      zIndex: 0,
      filter: "blur(28px)",
    }}>
      {orbs.map((orb, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${orb.cx}%`, top: `${orb.cy}%`,
          transform: "translate(-50%, -50%)",
          width: `${orb.r}%`, height: `${orb.r * 1.6}%`,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${orb.color} 0%, transparent 70%)`,
          opacity: orb.opacity,
        }} />
      ))}
    </div>
  );
}


type HeroStage = "idle" | "search" | "results" | "score" | "pause";

function HeroScene({ scrollY, waitlistCount, heroTextOpacity, sequenceProgress, scrollLocked }: {
  scrollY: number;
  waitlistCount: number | null;
  heroTextOpacity: number;
  sequenceProgress: number;
  scrollLocked: boolean;
}) {
  const [stage, setStage] = useState<HeroStage>("idle");
  const [selectedLead, setSelectedLead] = useState(0);
  const [scoreAnimate, setScoreAnimate] = useState(false);
  const [visibleRows, setVisibleRows] = useState(0);
  const [cycleIndex, setCycleIndex] = useState(0);

  const activeCycle = SEARCH_CYCLES[cycleIndex % SEARCH_CYCLES.length];
  const activeLeads = activeCycle.leads;
  const activeQuery = activeCycle.query;

  // Galaxy particles — kept from old hero
  const [nearParticles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.4,
      duration: Math.random() * 10 + 6, delay: Math.random() * 8,
      opacity: Math.random() * 0.2 + 0.04,
    }))
  );
  const [deepParticles] = useState(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i + 100, x: Math.random() * 100, y: Math.random() * 100,
      size: Math.random() * 3 + 1.5,
      duration: Math.random() * 18 + 12, delay: Math.random() * 10,
      baseOpacity: Math.random() * 0.12 + 0.02,
    }))
  );

  const galaxyDepth = Math.min(1, scrollY / 800);
  const fieldRotation = scrollY * 0.015;
  // Scroll physics — scene tilts, rises, and leans as user scrolls

  // ── SEQUENCE ENGINE ──
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runCycle = (cycleIdx: number) => {
      const cycle = SEARCH_CYCLES[cycleIdx % SEARCH_CYCLES.length];
      // Reset
      setCycleIndex(cycleIdx);
      setStage("idle");
      setVisibleRows(0);
      setScoreAnimate(false);
      setSelectedLead(0);

      // Stage 1: start typing
      timers.push(setTimeout(() => setStage("search"), 300));

      // Stage 2: show results
      timers.push(setTimeout(() => {
        setStage("results");
        for (let r = 0; r < cycle.leads.length; r++) {
          timers.push(setTimeout(() => setVisibleRows(r + 1), r * 200));
        }
      }, STAGE_SEARCH));

      // Stage 3: select top lead (highest score) + animate score
      timers.push(setTimeout(() => {
        setStage("score");
        const topIdx = cycle.leads.reduce((best, l, i) =>
          l.score > cycle.leads[best].score ? i : best, 0);
        setSelectedLead(topIdx);
        setTimeout(() => setScoreAnimate(true), 200);
      }, STAGE_SEARCH + STAGE_RESULTS));

      // Stage 4: pause then loop
      timers.push(setTimeout(() => setStage("pause"), STAGE_SEARCH + STAGE_RESULTS + STAGE_SCORE));
      timers.push(setTimeout(() => runCycle(cycleIdx + 1), TOTAL_CYCLE));
    };

    const init = setTimeout(() => runCycle(0), 400);
    return () => {
      clearTimeout(init);
      timers.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lead = activeCycle.leads[selectedLead] ?? activeCycle.leads[0];

  return (
    <section style={{
      position: "relative", minHeight: "100vh",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "100px 24px 60px", overflow: "visible",
      background: "#080808",
    }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,168,76,0.1) 0%, transparent 65%)" }} />

      {/* Scrolling grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.018, backgroundImage: "linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)", backgroundSize: "72px 72px", transform: `translateY(${scrollY * 0.08}px)` }} />

      {/* Galaxy near layer */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: `rotate(${fieldRotation}deg)`, transformOrigin: "50% 40%" }}>
        {nearParticles.map(p => (
          <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: p.size + galaxyDepth * 0.8, height: p.size + galaxyDepth * 0.8, borderRadius: "50%", background: "#c9a84c", opacity: p.opacity + galaxyDepth * 0.12, animation: `particleDrift ${p.duration}s ease-in-out ${p.delay}s infinite alternate` }} />
        ))}
      </div>
      {/* Galaxy deep layer */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: `rotate(${-fieldRotation * 0.4}deg)`, transformOrigin: "50% 40%" }}>
        {deepParticles.map(p => (
          <div key={p.id} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: p.size * (1 + galaxyDepth * 1.2), height: p.size * (1 + galaxyDepth * 1.2), borderRadius: "50%", background: "radial-gradient(circle, #e8c97a 0%, #c9a84c 60%, transparent 100%)", opacity: p.baseOpacity + galaxyDepth * 0.3, animation: `starPulse ${p.duration}s ease-in-out ${p.delay}s infinite alternate`, boxShadow: galaxyDepth > 0.3 ? `0 0 ${4 + galaxyDepth * 8}px rgba(201,168,76,${galaxyDepth * 0.4})` : "none" }} />
        ))}
      </div>

      {/* ── HERO TEXT ── */}
      <HeroText
        scrollY={scrollY}
        heroTextOpacity={heroTextOpacity}
        waitlistCount={waitlistCount}
      />

    </section>
  );
}


// ── SCENE SECTION — 3D UI showcase that animates into frame on scroll ──
function SceneSection({ scrollY }: { scrollY: number }) {
  const [entered, setEntered] = useState(false);
  const [stage, setStage] = useState<HeroStage>("idle");
  const [cycleIndex, setCycleIndex] = useState(0);
  const [selectedLead, setSelectedLead] = useState(0);
  const [scoreAnimate, setScoreAnimate] = useState(false);
  const [visibleRows, setVisibleRows] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Intersection observer — triggers entry animation once
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !entered) setEntered(true); },
      { threshold: 0.15 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, [entered]);

  // Sequence engine — same as before, starts after entry
  useEffect(() => {
    if (!entered) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const runCycle = (cycleIdx: number) => {
      const cycle = SEARCH_CYCLES[cycleIdx % SEARCH_CYCLES.length];
      setCycleIndex(cycleIdx);
      setStage("idle");
      setVisibleRows(0);
      setScoreAnimate(false);
      setSelectedLead(0);
      timers.push(setTimeout(() => setStage("search"), 300));
      timers.push(setTimeout(() => {
        setStage("results");
        for (let r = 0; r < cycle.leads.length; r++) {
          timers.push(setTimeout(() => setVisibleRows(r + 1), r * 200));
        }
      }, STAGE_SEARCH));
      timers.push(setTimeout(() => {
        setStage("score");
        const topIdx = cycle.leads.reduce((best, l, i) => l.score > cycle.leads[best].score ? i : best, 0);
        setSelectedLead(topIdx);
        setTimeout(() => setScoreAnimate(true), 200);
      }, STAGE_SEARCH + STAGE_RESULTS));
      timers.push(setTimeout(() => setStage("pause"), STAGE_SEARCH + STAGE_RESULTS + STAGE_SCORE));
      timers.push(setTimeout(() => runCycle(cycleIdx + 1), TOTAL_CYCLE));
    };
    const init = setTimeout(() => runCycle(0), 600);
    return () => { clearTimeout(init); timers.forEach(clearTimeout); };
  }, [entered]);

  const activeCycle = SEARCH_CYCLES[cycleIndex % SEARCH_CYCLES.length];
  const activeLeads = activeCycle.leads;
  const activeQuery = activeCycle.query;
  const lead = activeCycle.leads[selectedLead] ?? activeCycle.leads[0];

  // Three-phase physics tilt arc
  // Hero is exactly 100vh, so scene is visible from scrollY≈0 upward.
  // relativeScroll = scrollY directly — starts as soon as user scrolls.
  // Phase 1 (0→300px):   0° → 18° fast snap — easeOutQuart
  // Phase 2 (300→700px):  holds at 18°
  // Phase 3 (700→1400px): 18° → -22° tips toward viewer — easeInCubic
  const relativeScroll = scrollY;

  const p1 = Math.min(1, relativeScroll / 300);
  const p3 = Math.max(0, (relativeScroll - 700) / 700);
  const easeOutQ = (t: number) => 1 - Math.pow(1 - t, 4);
  const easeInC  = (t: number) => t * t * t;
  const tiltFromEntry = easeOutQ(p1) * 18;
  const tiltForward   = easeInC(p3) * -40;

  const sceneTiltX = entered ? tiltFromEntry + tiltForward : 0;
  const sceneTiltY = entered ? -8 + Math.sin(relativeScroll * 0.004) * 5 : -4;
  const sceneTiltZ = entered ? relativeScroll * 0.004 : 0;
  const sceneTranslateY = entered ? -relativeScroll * 0.08 : 60;
  const sceneScale = entered ? Math.max(0.84, 1 - relativeScroll * 0.00012) : 0.9;
  const galaxyDepth = Math.min(1, relativeScroll / 800);

  return (
    <section
      ref={sectionRef}
      style={{
        background: "#080808",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 24px 80px",
        overflow: "visible",
        position: "relative",
      }}
    >
      {/* Option C entry: starts tilted flat + faded, eases to resting angle */}
      <div style={{
        width: "100%", maxWidth: "min(1100px, 92vw)",
        perspective: "1400px",
        position: "relative", zIndex: 5,
        opacity: entered ? 1 : 0,
        transition: entered
          ? "opacity 0.6s ease 0.1s"
          : "none",
      }}>
        <div style={{
          transform: `translateY(${sceneTranslateY}px) rotateX(${sceneTiltX}deg) rotateY(${sceneTiltY}deg) rotateZ(${sceneTiltZ}deg) scale(${sceneScale})`,
          transformStyle: "preserve-3d",
          transition: entered
            ? "transform 1.4s cubic-bezier(0.16,1,0.3,1), opacity 0.6s ease"
            : "none",
          transformOrigin: "50% 50%",
        }}>
          {/* Surface panel */}
          <div style={{
            background: "#0e0e0e",
            border: "1px solid #2a2a2a",
            borderRadius: 20,
            overflow: "hidden",
            boxShadow: "0 40px 120px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}>
            {/* Surface grid */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.025, backgroundImage: "linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)", backgroundSize: "40px 40px", borderRadius: 20 }} />
            {/* Top chrome bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: "1px solid #1a1a1a", background: "rgba(255,255,255,0.01)" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2a2a2a" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2a2a2a" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2a2a2a" }} />
              <div style={{ flex: 1, margin: "0 16px", height: 24, background: "#111", borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 10, gap: 6 }}>
                <span style={{ fontSize: 9, color: "#333", letterSpacing: "0.06em" }}>◈</span>
                <span style={{ fontSize: 10, color: "#333", letterSpacing: "0.04em" }}>vantioapp.com</span>
              </div>
              <div style={{ padding: "4px 12px", borderRadius: 6, background: "#c9a84c", fontSize: 10, fontWeight: 700, color: "#080808", letterSpacing: "0.08em" }}>SCAN</div>
            </div>
            {/* App content */}
            <div style={{ padding: "20px 24px", height: 420, overflow: "hidden", position: "relative" }}>
              {/* Search bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 10, border: "1px solid #1a1a1a", background: "#0a0a0a", marginBottom: 16 }}>
                <span style={{ fontSize: 14, color: "#c9a84c" }}>🔍</span>
                <span style={{ fontSize: 13, color: stage === "idle" ? "#333" : "#e8e0d0", fontFamily: "var(--font-body), sans-serif", letterSpacing: "0.01em", flex: 1 }}>
                  {stage === "idle" ? (
                    <span style={{ color: "#333" }}>Search niche + location…</span>
                  ) : (
                    <TypedText text={activeQuery} started={stage !== ("idle" as HeroStage)} />
                  )}
                </span>
                <div style={{ padding: "4px 12px", borderRadius: 6, background: stage === "results" || stage === "score" || stage === "pause" ? "#c9a84c" : "#1e1e1e", fontSize: 10, fontWeight: 700, color: stage === "results" || stage === "score" || stage === "pause" ? "#080808" : "#444", letterSpacing: "0.08em", transition: "all 0.4s ease" }}>
                  SCAN
                </div>
              </div>
              {/* Results header */}
              {(stage === "results" || stage === "score" || stage === "pause") && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 4px" }}>
                  <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {activeLeads.length} leads found · scored against your profile
                  </span>
                  <div style={{ flex: 1 }} />
                  {["Score ↓", "Fit", "Gap"].map(label => (
                    <span key={label} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid #1a1a1a", color: "#444", letterSpacing: "0.06em" }}>{label}</span>
                  ))}
                </div>
              )}
              {/* Lead rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeLeads.map((l, i) => {
                  const rowVisible = i < visibleRows;
                  const isSelected = stage === "score" || stage === "pause";
                  const isThisOne = isSelected && i === selectedLead;
                  return (
                    <div key={i} style={{
                      borderRadius: 10,
                      border: `1px solid ${isThisOne ? "rgba(201,168,76,0.3)" : "#1a1a1a"}`,
                      background: isThisOne ? "rgba(201,168,76,0.06)" : "#111",
                      overflow: "hidden",
                      opacity: rowVisible ? 1 : 0,
                      maxHeight: rowVisible ? 300 : 0,
                      marginBottom: rowVisible ? undefined : 0,
                      transform: rowVisible ? "none" : "translateY(6px)",
                      transition: `opacity 0.35s ease ${i * 80}ms, max-height 0.35s ease ${i * 80}ms, transform 0.35s ease ${i * 80}ms, border-color 0.3s ease, background 0.3s ease`,
                      boxShadow: isThisOne ? "0 4px 24px rgba(201,168,76,0.08)" : "none",
                    }}>
                      {isThisOne ? (
                        <div style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#f5f0e8" }}>{l.name}</span>
                                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: "1px solid #2a2a2a", color: "#555", letterSpacing: "0.06em" }}>{l.industry}</span>
                              </div>
                              <span style={{ fontSize: 11, color: "#444" }}>📍 {l.city}</span>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 28, fontWeight: 700, color: l.score >= 75 ? "#4ade80" : l.score >= 55 ? "#c9a84c" : "#f87171", lineHeight: 1 }}>{l.score}</div>
                              <p style={{ fontSize: 8, color: "#444", textTransform: "uppercase", letterSpacing: "0.06em" }}>score</p>
                            </div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                            {[{ label: "Fit", value: l.fit, color: "#818cf8" }, { label: "Opportunity", value: l.opp, color: "#4ade80" }, { label: "Risk", value: l.risk, color: "#f87171" }].map(bar => (
                              <ScoreBar key={bar.label} label={bar.label} value={bar.value} color={bar.color} animate={scoreAnimate} delay={0} />
                            ))}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: l.gapColor + "22", border: `1px solid ${l.gapColor}44`, color: l.gapColor, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>⬡ {l.gap} GAP DETECTED</span>
                            <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, background: l.verdictColor + "22", border: `1px solid ${l.verdictColor}44`, color: l.verdictColor, fontWeight: 700, letterSpacing: "0.06em" }}>{l.verdict}</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#e8e0d0" }}>{l.name}</span>
                              <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, border: "1px solid #1e1e1e", color: "#444", letterSpacing: "0.04em" }}>{l.industry}</span>
                            </div>
                            <span style={{ fontSize: 10, color: "#333" }}>📍 {l.city}</span>
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: l.score >= 75 ? "#4ade80" : l.score >= 55 ? "#c9a84c" : "#f87171", minWidth: 36, textAlign: "right" }}>{l.score}</div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: l.verdictColor + "18", color: l.verdictColor, fontWeight: 700, letterSpacing: "0.04em" }}>{l.verdict}</span>
                            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: l.gapColor + "18", color: l.gapColor, fontWeight: 700, letterSpacing: "0.06em" }}>⬡ {l.gap}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Scanning pulse */}
              {stage === "search" && (
                <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9a84c", animation: "pulse 1s infinite" }} />
                  <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Scanning signals…</span>
                </div>
              )}
            </div>
          </div>
          {/* Scene underglow */}
          <div style={{ position: "absolute", bottom: -40, left: "5%", right: "5%", height: 80, background: "radial-gradient(ellipse, rgba(201,168,76,0.15) 0%, transparent 70%)", filter: "blur(20px)", pointerEvents: "none" }} />
        </div>
      </div>
    </section>
  );
}


// Button with internal mouse-tracking glow — Huly style
// Section with clip-path reveal — mouse position reveals a gold underglow
// Huly's technique: CSS vars --mx --my drive clip-path circle on a glowing layer
function GlowSection({ children, style = {}, glowColor = "rgba(201,168,76,0.08)" }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  glowColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [clipPos, setClipPos] = useState<{ x: number; y: number } | null>(null);

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setClipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setClipPos(null)}
      style={{ position: "relative", ...style }}
    >
      {/* Revealed underglow layer */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(600px circle at ${clipPos ? clipPos.x : -9999}px ${clipPos ? clipPos.y : -9999}px, ${glowColor}, transparent 60%)`,
        pointerEvents: "none",
        transition: clipPos ? "none" : "background 0.6s ease",
        zIndex: 0,
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}


function GlowButton({ href, children, style = {} }: { href: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPos(null); }}
      style={{ display: "inline-block", position: "relative" }}
    >
    <Link
      href={href}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-block",
        ...style,
      }}
    >
      {/* Mouse-tracked inner glow */}
      {pos && (
        <span style={{
          position: "absolute",
          left: pos.x - 100, top: pos.y - 100,
          width: 200, height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.1) 50%, transparent 70%)",
          pointerEvents: "none",
          transition: "none",
          mixBlendMode: "overlay",
        }} />
      )}
      {/* Edge shimmer on hover */}
      <span style={{
        position: "absolute", inset: 0,
        borderRadius: "inherit",
        background: hovered
          ? "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%, rgba(255,255,255,0.04) 100%)"
          : "transparent",
        transition: "background 0.3s ease",
        pointerEvents: "none",
      }} />
      {children}
    </Link>
    </div>
  );
}


export default function LandingPage() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);

  const [moteParticles] = useState(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.2 + 0.4,
      duration: Math.random() * 20 + 14,
      delay: Math.random() * 12,
      opacity: Math.random() * 0.3 + 0.12,
      driftX: (Math.random() - 0.5) * 28,
      driftY: (Math.random() - 0.5) * 22,
      diamond: i % 3 === 0,
    }))
  );

  const [featuresRef, featuresVisible] = useReveal();
  const [stepsRef, stepsVisible] = useReveal();
  const [diffRef, diffVisible] = useReveal();
  const [ctaRef, ctaVisible] = useReveal();

  useEffect(() => {
    fetch("/api/waitlist").then(r => r.json()).then(d => {
      if (typeof d.count === "number" && d.count > 0) setWaitlistCount(d.count);
    }).catch(() => {});
  }, []);

  const [sequenceProgress, setSequenceProgress] = useState(0);
  const scrollLocked = false;


  useEffect(() => {
    // Track sequence progress for the indicator bar
    const startTime = performance.now();
    let rafId: number;
    const tick = (now: number) => {
      const elapsed = (now - startTime) % TOTAL_CYCLE;
      setSequenceProgress(elapsed / TOTAL_CYCLE);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);








  const heroTextOpacity = Math.max(0, 1 - scrollY * 0.003);

  return (
    <div style={{ minHeight: "100vh", background: "#080808", color: "#f5f0e8", overflowX: "hidden" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", borderBottom: "1px solid #181818", background: "rgba(8,8,8,0.92)", backdropFilter: "blur(16px)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <span style={{ color: "#c9a84c", fontSize: 18 }}>◈</span>
          <span style={{ fontFamily: "var(--font-display), serif", fontSize: 20, fontWeight: 600, letterSpacing: "0.04em", color: "#f5f0e8" }}>
            Van<span style={{ background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>tio</span>
          </span>
        </Link>

        {/* Beta badge — right of logo */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, border: "1px solid rgba(201,168,76,0.2)", background: "rgba(201,168,76,0.04)", marginLeft: 20 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c9a84c", display: "inline-block", animation: "pulse 2s infinite", flexShrink: 0 }} />
          <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c9a84c", whiteSpace: "nowrap" }}>
            Closed Beta
          </span>
        </div>

        {/* Spacer pushes nav links to the right */}
        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/plans" style={{ fontSize: 13, color: "#555", textDecoration: "none", letterSpacing: "0.06em" }}>Pricing</Link>
          <Link href="/login" style={{ fontSize: 13, padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(201,168,76,0.3)", color: "#c9a84c", textDecoration: "none", letterSpacing: "0.06em" }}>Get Early Access</Link>
          <HamburgerMenu hasProfile={false} />
        </div>
      </nav>

      {/* HERO */}
      <HeroScene
        scrollY={scrollY}
        waitlistCount={waitlistCount}
        heroTextOpacity={heroTextOpacity}
        sequenceProgress={sequenceProgress}
        scrollLocked={scrollLocked}
      />

      {/* UI SHOWCASE — animates into frame on scroll */}
      <SceneSection scrollY={scrollY} />

            {/* STAT BAR */}
      <StatBar />

      {/* Section boundary glow */}
      <div style={{ height: 1, background: "transparent", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "70%", height: 120, background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      </div>

      {/* FEATURES */}
      <div ref={featuresRef} style={{ position: "relative" }}>
        {/* Mote particle field — absolutely covers the full section, no overflow clip */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
          {moteParticles.map(p => (
            <div key={p.id} style={{
              position: "absolute",
              left: `${p.x}%`, top: `${p.y}%`,
              width: p.size + 1,
              height: p.size + 1,
              background: p.diamond ? "transparent" : "#c9a84c",
              border: p.diamond ? "1px solid rgba(201,168,76,0.7)" : "none",
              borderRadius: p.diamond ? "0" : "50%",
              transform: p.diamond ? "rotate(45deg)" : "none",
              opacity: p.opacity * 2.5,
              animation: `moteDrift${p.id % 4} ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }} />
          ))}
        </div>
        <section style={{ padding: "96px 24px", maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ marginBottom: 64, textAlign: "center", opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? "none" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>What Vantio does</p>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300 }}>
              Not a lead list.{" "}
              <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lead intelligence.</em>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} f={f} i={i} visible={featuresVisible} />
            ))}
          </div>
        </section>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)" }} />
      </div>

      {/* HOW IT WORKS */}
      {/* Section boundary glow */}
      <div style={{ height: 1, background: "transparent", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "60%", height: 140, background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      </div>

      <div ref={stepsRef}>
        <section id="how-it-works" style={{ padding: "112px 48px", maxWidth: 960, margin: "0 auto" }}>
          <div style={{ marginBottom: 64, textAlign: "center", opacity: stepsVisible ? 1 : 0, transform: stepsVisible ? "none" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>The process</p>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300 }}>
              From search to{" "}
              <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>signed client.</em>
            </h2>
          </div>
          <StepsSection visible={stepsVisible} scrollY={scrollY} />
        </section>
      </div>

      {/* Section boundary glow */}
      <div style={{ height: 1, background: "transparent", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "80%", height: 160, background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      </div>

      {/* DIFFERENTIATOR — cinematic rebuild */}
      <div ref={diffRef}>
        <GlowSection style={{ background: "#050505", borderTop: "1px solid #0e0e0e", overflow: "hidden" }} glowColor="rgba(201,168,76,0.06)">
          <section style={{ padding: "120px 24px 100px", position: "relative" }}>

            {/* Background ambient glow behind Vantio column */}
            <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 65%)", pointerEvents: "none", filter: "blur(40px)" }} />

            {/* Giant Scarabynth-style backdrop text */}
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", overflow: "hidden",
            }}>
              <p style={{
                fontFamily: "var(--font-display), serif",
                fontSize: "clamp(80px, 14vw, 180px)",
                fontWeight: 700, letterSpacing: "-0.04em",
                color: "transparent",
                WebkitTextStroke: "1px rgba(201,168,76,0.07)",
                whiteSpace: "nowrap",
                userSelect: "none",
                opacity: diffVisible ? 1 : 0,
                transition: "opacity 1.2s ease",
              }}>
                INTELLIGENCE
              </p>
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>

              {/* Header */}
              <div style={{
                marginBottom: 80, textAlign: "center",
                opacity: diffVisible ? 1 : 0,
                transform: diffVisible ? "none" : "translateY(40px)",
                transition: "all 0.9s cubic-bezier(0.16,1,0.3,1)",
              }}>
                <p style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 20 }}>Why Vantio is different</p>
                <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(36px,5.5vw,64px)", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                  Other tools give you names.
                  <br />
                  <em style={{ fontStyle: "italic", fontWeight: 600, background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    We give you reasons.
                  </em>
                </h2>
              </div>

              {/* Three floating cards — Vantio physically elevated */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 16, alignItems: "end" }}>
                {[
                  {
                    label: "Typical lead lists", icon: "✗", iconColor: "#444", highlight: false,
                    desc: "A spreadsheet of names. No context, no scoring, no guidance.",
                    points: ["Name, phone, address only", "No scoring or context", "Same list for everyone", "Manual research required", "No outreach guidance"],
                    delay: 0,
                  },
                  {
                    label: "Vantio", icon: "◈", iconColor: "#c9a84c", highlight: true,
                    desc: "Signal-driven intelligence matched to your exact service profile.",
                    points: ["Signal-driven lead score", "Gap type + pitch angle", "Matched to your profile", "Website signals auto-scanned", "AI outreach from your offer"],
                    delay: 120,
                  },
                  {
                    label: "Manual research", icon: "✗", iconColor: "#444", highlight: false,
                    desc: "1–2 hours per lead. Inconsistent. Impossible to scale.",
                    points: ["Hours per lead", "Inconsistent judgment", "No structured scoring", "Easy to miss signals", "Hard to scale"],
                    delay: 240,
                  },
                ].map((col, i) => (
                  <div key={i} style={{
                    borderRadius: 20,
                    border: col.highlight ? "1px solid rgba(201,168,76,0.25)" : "1px solid #111",
                    background: col.highlight ? "linear-gradient(160deg, rgba(201,168,76,0.07) 0%, rgba(201,168,76,0.02) 100%)" : "#080808",
                    padding: "36px 28px",
                    position: "relative",
                    overflow: "hidden",
                    opacity: diffVisible ? 1 : 0,
                    transform: diffVisible
                      ? col.highlight ? "translateY(-20px)" : "translateY(0)"
                      : "translateY(50px)",
                    transition: `all 0.8s cubic-bezier(0.16,1,0.3,1) ${col.delay}ms`,
                    boxShadow: col.highlight
                      ? "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.12), 0 40px 60px rgba(201,168,76,0.06)"
                      : "0 8px 32px rgba(0,0,0,0.4)",
                  }}>
                    {/* Spotlight underneath Vantio card */}
                    {col.highlight && (
                      <div style={{ position: "absolute", bottom: -40, left: "50%", transform: "translateX(-50%)", width: 300, height: 80, background: "radial-gradient(ellipse, rgba(201,168,76,0.18) 0%, transparent 70%)", filter: "blur(16px)", pointerEvents: "none" }} />
                    )}
                    {/* Top edge accent */}
                    {col.highlight && (
                      <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: 1, background: "linear-gradient(90deg, transparent, #c9a84c, transparent)" }} />
                    )}

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      <span style={{ fontSize: col.highlight ? 20 : 14, color: col.iconColor }}>{col.icon}</span>
                      <p style={{ fontSize: col.highlight ? 16 : 13, fontWeight: 700, letterSpacing: "0.04em", color: col.highlight ? "#e8c97a" : "#333" }}>{col.label}</p>
                      {col.highlight && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(201,168,76,0.15)", color: "#c9a84c", letterSpacing: "0.12em", textTransform: "uppercase", marginLeft: "auto" }}>You are here</span>}
                    </div>

                    <p style={{ fontSize: 12, color: col.highlight ? "#777" : "#2a2a2a", lineHeight: 1.6, marginBottom: 24 }}>{col.desc}</p>

                    {/* Divider */}
                    <div style={{ height: 1, background: col.highlight ? "rgba(201,168,76,0.1)" : "#111", marginBottom: 20 }} />

                    {/* Points */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                      {col.points.map((pt, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <span style={{ fontSize: 10, color: col.highlight ? "#4ade80" : "#2a2a2a", flexShrink: 0, marginTop: 2 }}>{col.highlight ? "✓" : "—"}</span>
                          <p style={{ fontSize: 12, lineHeight: 1.5, color: col.highlight ? "#999" : "#2a2a2a" }}>{pt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </GlowSection>
      </div>

      {/* Section boundary glow */}
      <div style={{ height: 1, background: "transparent", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: "60%", height: 120, background: "radial-gradient(ellipse at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      </div>

      {/* CTA — cinematic closer */}
      <div ref={ctaRef}>
        <section style={{ position: "relative", overflow: "hidden", background: "#040404", padding: "140px 24px 120px" }}>

          {/* Dense gold particle field — echoes the hero galaxy */}
          {ctaVisible && Array.from({ length: 50 }, (_, i) => ({
            id: i,
            x: Math.sin(i * 2.4) * 50 + 50,
            y: Math.cos(i * 1.7) * 50 + 50,
            size: (i % 4 === 0) ? 2.5 : 1,
            opacity: i % 5 === 0 ? 0.35 : 0.12,
            duration: 8 + (i % 7) * 2,
            delay: (i % 6) * 1.5,
          })).map(p => (
            <div key={p.id} style={{
              position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
              width: p.size, height: p.size, borderRadius: "50%",
              background: "#c9a84c", opacity: p.opacity,
              animation: `particleDrift ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
              pointerEvents: "none",
            }} />
          ))}

          {/* Deep ambient glow */}
          <div style={{ position: "absolute", bottom: -100, left: "50%", transform: "translateX(-50%)", width: 800, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(201,168,76,0.1) 0%, transparent 65%)", filter: "blur(60px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: -50, left: "50%", transform: "translateX(-50%)", width: 600, height: 200, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(201,168,76,0.05) 0%, transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

          <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>

            {/* Eyebrow */}
            <p style={{
              fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 32,
              opacity: ctaVisible ? 1 : 0, transition: "opacity 0.8s ease",
            }}>
              Join the beta
            </p>

            {/* Giant headline — Scarabynth scale */}
            <h2 style={{
              fontFamily: "var(--font-display), serif",
              fontSize: "clamp(52px, 9vw, 110px)",
              fontWeight: 300, lineHeight: 0.95, letterSpacing: "-0.03em",
              marginBottom: 40,
              opacity: ctaVisible ? 1 : 0,
              transform: ctaVisible ? "none" : "translateY(40px)",
              transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.1s",
            }}>
              Stop guessing.
              <br />
              <em style={{ fontStyle: "italic", fontWeight: 600, background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 45%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Start converting.
              </em>
            </h2>

            {/* Animated gold rule */}
            <div style={{
              height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)",
              marginBottom: 40, maxWidth: 480, margin: "0 auto 40px",
              transform: ctaVisible ? "scaleX(1)" : "scaleX(0)",
              transition: "transform 1s cubic-bezier(0.16,1,0.3,1) 0.4s",
              transformOrigin: "center",
            }} />

            {/* Subtext */}
            <p style={{
              fontSize: 15, color: "#555", maxWidth: 520, margin: "0 auto 56px", lineHeight: 1.75,
              opacity: ctaVisible ? 1 : 0,
              transition: "opacity 0.8s ease 0.5s",
            }}>
              We&apos;re opening beta access to a limited number of service providers. Create your profile now and get matched leads from day one.
            </p>

            {/* CTA button in a gold pool */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: -40, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(201,168,76,0.15) 0%, transparent 70%)", filter: "blur(20px)", pointerEvents: "none", opacity: ctaVisible ? 1 : 0, transition: "opacity 1s ease 0.8s" }} />
              <div style={{
                opacity: ctaVisible ? 1 : 0,
                transform: ctaVisible ? "none" : "translateY(20px)",
                transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.7s",
              }}>
                <GlowButton href="/login" style={{ padding: "18px 48px", borderRadius: 14, background: "#c9a84c", color: "#080808", fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", textDecoration: "none", boxShadow: "0 12px 50px rgba(201,168,76,0.3), 0 4px 20px rgba(201,168,76,0.2)" }}>
                  Create Your Profile — It&apos;s Free
                </GlowButton>
              </div>
            </div>

            <p style={{ marginTop: 24, fontSize: 11, color: "#2a2a2a", letterSpacing: "0.1em", opacity: ctaVisible ? 1 : 0, transition: "opacity 0.8s ease 1s" }}>
              No credit card required · Cancel anytime
            </p>
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #111", padding: "32px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#8a6e30", fontSize: 14 }}>◈</span>
            <span style={{ fontFamily: "var(--font-display), serif", fontSize: 14, color: "#333" }}>Vantio</span>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["Pricing", "/plans"], ["Get Access", "/login"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
              <Link key={label} href={href} style={{ fontSize: 12, color: "#333", textDecoration: "none" }}>{label}</Link>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "#222", letterSpacing: "0.06em" }}>© {new Date().getFullYear()} Vantio. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
@keyframes nodeRipple {
          0% { r: 14; opacity: 0.4; }
          100% { r: 28; opacity: 0; }
        }
        @keyframes moteDrift0 {
          from { transform: translate(0px, 0px) rotate(45deg); }
          to   { transform: translate(18px, -14px) rotate(45deg); }
        }
        @keyframes moteDrift1 {
          from { transform: translate(0px, 0px); }
          to   { transform: translate(-14px, -20px); }
        }
        @keyframes moteDrift2 {
          from { transform: translate(0px, 0px) rotate(45deg); }
          to   { transform: translate(-20px, 10px) rotate(45deg); }
        }
        @keyframes moteDrift3 {
          from { transform: translate(0px, 0px); }
          to   { transform: translate(12px, 18px); }
        }
        @keyframes particleDrift {
          from { transform: translateY(0px) scale(1); opacity: inherit; }
          to { transform: translateY(-14px) scale(1.2); opacity: inherit; }
        }
        @keyframes starPulse {
          from { transform: scale(1); }
          to { transform: scale(1.4); }
        }
        @media (max-width: 900px) {
          nav { padding: 14px 20px !important; }
        }
        @media (max-width: 700px) {
          /* Hide orbital chips on small screens — they overlap badly */
          .orbital-chip { display: none; }
        }
      `}</style>
    </div>
  );
}
