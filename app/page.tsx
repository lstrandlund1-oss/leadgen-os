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
  const SCROLL_START = 2100;  // slightly before step 2 is fully visible
  const SCROLL_RANGE = 600;   // faster — completes in 600px of scroll
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


// ── SEARCH CYCLES DATA ──
const SEARCH_CYCLES = [
  {
    q: "beauty salons · london",
    leads: [
      { n: "Luxe Nail & Spa",       score: 88, sc: "#4ade80", vc: "#4ade80", v: "Top Lead", fit: 92, opp: 85, risk: 10, gap: "CONVERSION",     gc: "#fb923c",
        msg: (n: string) => `Hi — <em>${n}</em> has no mobile booking CTA. I'll build one, install it, and send you a <strong>live preview within 48 hours</strong>. No commitment needed.` },
      { n: "Studio Muse London",    score: 79, sc: "#4ade80", vc: "#4ade80", v: "Strong",   fit: 84, opp: 74, risk: 18, gap: "INFRASTRUCTURE",  gc: "#60a5fa", msg: null },
      { n: "Bloom & Co Studio",     score: 74, sc: "#4ade80", vc: "#4ade80", v: "Strong",   fit: 81, opp: 68, risk: 22, gap: "CONVERSION",      gc: "#fb923c", msg: null },
      { n: "Glow Beauty Bar",       score: 61, sc: "#c9a84c", vc: "#c9a84c", v: "Good",     fit: 70, opp: 55, risk: 30, gap: "VISIBILITY",      gc: "#818cf8", msg: null },
      { n: "The Beauty Collective", score: 45, sc: "#f87171", vc: "#f87171", v: "Weak",     fit: 38, opp: 50, risk: 55, gap: "OPTIMISATION",    gc: "#f472b6", msg: null },
    ],
    hint: "5 leads scored · beauty salons · london",
  },
  {
    q: "web agencies · stockholm",
    leads: [
      { n: "Brightpath Agency", score: 91, sc: "#4ade80", vc: "#4ade80", v: "Top Lead", fit: 95, opp: 88, risk: 8,  gap: "INFRASTRUCTURE", gc: "#60a5fa",
        msg: (n: string) => `Hey — <em>${n}</em> has no lead capture on the site. I'll build a <strong>free working prototype</strong> and send it over by Friday. Just reply yes.` },
      { n: "Norr Studio AB",    score: 82, sc: "#4ade80", vc: "#4ade80", v: "Top Lead", fit: 88, opp: 79, risk: 14, gap: "CONVERSION",     gc: "#fb923c", msg: null },
      { n: "Studio Noll",       score: 73, sc: "#4ade80", vc: "#4ade80", v: "Strong",   fit: 77, opp: 68, risk: 22, gap: "CONVERSION",     gc: "#fb923c", msg: null },
      { n: "Pixel & Pine",      score: 67, sc: "#c9a84c", vc: "#c9a84c", v: "Good",    fit: 60, opp: 72, risk: 28, gap: "VISIBILITY",     gc: "#818cf8", msg: null },
      { n: "Forma Digital",     score: 55, sc: "#f87171", vc: "#f87171", v: "Weak",    fit: 50, opp: 61, risk: 40, gap: "OPTIMISATION",   gc: "#f472b6", msg: null },
    ],
    hint: "5 leads scored · web agencies · stockholm",
  },
  {
    q: "personal trainers · manchester",
    leads: [
      { n: "Peak Form PT",         score: 86, sc: "#4ade80", vc: "#4ade80", v: "Top Lead", fit: 90, opp: 83, risk: 12, gap: "VISIBILITY",      gc: "#818cf8",
        msg: (n: string) => `Hi — <em>${n}</em> is invisible on Google in Manchester. I'll send a <strong>free visibility audit</strong> with 3 fixes you can action today. Want it?` },
      { n: "Momentum Fitness MCR", score: 80, sc: "#4ade80", vc: "#4ade80", v: "Strong",   fit: 85, opp: 76, risk: 16, gap: "CONVERSION",      gc: "#fb923c", msg: null },
      { n: "Elevate Coaching",     score: 77, sc: "#4ade80", vc: "#4ade80", v: "Strong",   fit: 82, opp: 73, risk: 20, gap: "OPTIMISATION",    gc: "#f472b6", msg: null },
      { n: "Iron & Grit Fitness",  score: 62, sc: "#c9a84c", vc: "#c9a84c", v: "Good",    fit: 58, opp: 66, risk: 34, gap: "CONVERSION",      gc: "#fb923c", msg: null },
      { n: "Body Blueprint",       score: 49, sc: "#f87171", vc: "#f87171", v: "Weak",    fit: 42, opp: 55, risk: 50, gap: "INFRASTRUCTURE",  gc: "#60a5fa", msg: null },
    ],
    hint: "5 leads scored · personal trainers · manchester",
  },
];

type Lead = typeof SEARCH_CYCLES[0]["leads"][0];
type Cycle = typeof SEARCH_CYCLES[0];

// ── HERO SCENE — flat dashboard + unified particle canvas ──
function HeroScene({ scrollY, waitlistCount }: {
  scrollY: number;
  waitlistCount: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{x:number;y:number;vx:number;vy:number;r:number;baseOp:number;ph:number;sp:number;layer:number}[]>([]);
  const nebulaRef = useRef<{x:number;y:number;rx:number;ry:number;op:number;ph:number;sp:number;vx:number;vy:number;hue:string}[]>([]);
  const shooterRef = useRef<{x:number;y:number;vx:number;vy:number;len:number;op:number;active:boolean;timer:number}[]>([]);
  const burstRef = useRef({ v: 0, cx: 0.5, cy: 0.5 });
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  // Dashboard sequence state
  const [queryText, setQueryText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showResultsHead, setShowResultsHead] = useState(false);
  const [leadCount, setLeadCount] = useState(0);
  const [showRing, setShowRing] = useState(false);
  const [ringScore, setRingScore] = useState(0);
  const [ringColor, setRingColor] = useState("#4ade80");
  const [ringOffset, setRingOffset] = useState(226);
  const [topLead, setTopLead] = useState<Lead | null>(null);
  const [showBars, setShowBars] = useState(false);
  const [barFit, setBarFit] = useState(0);
  const [barOpp, setBarOpp] = useState(0);
  const [barRisk, setBarRisk] = useState(0);
  const [showAiMsg, setShowAiMsg] = useState(false);
  const [aiMsgText, setAiMsgText] = useState("");
  const [aiMsgFull, setAiMsgFull] = useState("");
  const [aiMsgDone, setAiMsgDone] = useState(false);
  const [footerHint, setFooterHint] = useState("Analysing signals…");
  const cycleIdxRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── GOLDEN GALAXY INIT ──
  useEffect(() => {
    // Layer 1: deep background stars — tiny, dense, barely moving
    const deep = Array.from({ length: 220 }, (_, i) => ({
      x: Math.random() * 100, y: Math.random() * 100,
      r: Math.random() * 0.7 + 0.15,
      op: Math.random() * 0.25 + 0.05,
      ph: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.0002 + 0.00005,
      vx: (Math.random() - 0.5) * 0.0015,
      vy: (Math.random() - 0.5) * 0.0015,
      layer: 0,
    }));
    // Layer 2: mid stars — slightly larger, warm gold tint
    const mid = Array.from({ length: 90 }, (_, i) => ({
      x: Math.random() * 100, y: Math.random() * 100,
      r: Math.random() * 1.1 + 0.4,
      op: Math.random() * 0.35 + 0.08,
      ph: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.0004 + 0.0001,
      vx: (Math.random() - 0.5) * 0.003,
      vy: (Math.random() - 0.5) * 0.003,
      layer: 1,
    }));
    // Layer 3: bright foreground stars — large, glowing, pulsy
    const fore = Array.from({ length: 28 }, (_, i) => ({
      x: Math.random() * 100, y: Math.random() * 100,
      r: Math.random() * 1.8 + 0.8,
      op: Math.random() * 0.5 + 0.2,
      ph: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.0008 + 0.0003,
      vx: (Math.random() - 0.5) * 0.005,
      vy: (Math.random() - 0.5) * 0.005,
      layer: 2,
    }));
    // Nebula clouds — large soft blobs that drift slowly
    const nebulae = Array.from({ length: 6 }, (_, i) => ({
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      rx: 120 + Math.random() * 200,
      ry: 80 + Math.random() * 140,
      op: Math.random() * 0.028 + 0.008,
      ph: Math.random() * Math.PI * 2,
      sp: Math.random() * 0.00008 + 0.00003,
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.0008,
      hue: i % 2 === 0 ? "201,168,76" : "232,201,122",
    }));
    // Shooting stars
    const shooters: {x:number;y:number;vx:number;vy:number;len:number;op:number;active:boolean;timer:number}[] = Array.from({ length: 4 }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, len: 0, op: 0, active: false, timer: Math.random() * 8000,
    }));

    particlesRef.current = [...deep, ...mid, ...fore] as typeof particlesRef.current;
    nebulaRef.current = nebulae;
    shooterRef.current = shooters;
  }, []);

  // Canvas draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize, { passive: true });
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX / W, y: e.clientY / H }; };
    window.addEventListener("mousemove", onMouse, { passive: true });

    let lastT = 0;

    function draw(t: number) {
      const dt = t - lastT; lastT = t;
      ctx.clearRect(0, 0, W, H);

      const burst = burstRef.current;
      burst.v = Math.max(0, burst.v - 0.008);
      const { x: mx, y: my } = mouseRef.current;
      const pts = particlesRef.current;
      const nebulae = nebulaRef.current;
      const shooters = shooterRef.current;

      // ── 1. NEBULA CLOUDS ──
      if (nebulae?.length) {
        for (const n of nebulae) {
          n.x = (n.x + n.vx + 100) % 100;
          n.y = (n.y + n.vy + 100) % 100;
          const breathe = 0.7 + Math.sin(t * n.sp + n.ph) * 0.3;
          const op = n.op * breathe * (1 + burst.v * 1.5);
          const grd = ctx.createRadialGradient(
            n.x*W/100, n.y*H/100, 0,
            n.x*W/100, n.y*H/100, Math.max(n.rx, n.ry)
          );
          grd.addColorStop(0, `rgba(${n.hue},${op.toFixed(3)})`);
          grd.addColorStop(0.5, `rgba(${n.hue},${(op*0.4).toFixed(3)})`);
          grd.addColorStop(1, `rgba(${n.hue},0)`);
          ctx.save();
          ctx.translate(n.x*W/100, n.y*H/100);
          ctx.scale(n.rx/Math.max(n.rx,n.ry), n.ry/Math.max(n.rx,n.ry));
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(n.rx,n.ry), 0, Math.PI*2);
          ctx.fillStyle = grd; ctx.fill();
          ctx.restore();
        }
      }

      // ── 2. GALAXY CORE glow (central warm bloom) ──
      const coreX = W * 0.5 + Math.sin(t * 0.00008) * W * 0.04;
      const coreY = H * 0.45 + Math.cos(t * 0.00006) * H * 0.03;
      const core = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, W * 0.45);
      core.addColorStop(0, `rgba(201,168,76,${0.03 + burst.v * 0.06})`);
      core.addColorStop(0.3, `rgba(180,140,50,${0.015 + burst.v * 0.03})`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core; ctx.fillRect(0, 0, W, H);

      // ── 3. MOUSE PARALLAX glow ──
      const mg = ctx.createRadialGradient(mx*W, my*H, 0, mx*W, my*H, 320);
      mg.addColorStop(0, "rgba(232,201,122,0.05)"); mg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);

      // ── 4. BURST GLOW ──
      if (burst.v > 0.01) {
        const bg = ctx.createRadialGradient(burst.cx*W, burst.cy*H, 0, burst.cx*W, burst.cy*H, 600);
        bg.addColorStop(0, `rgba(232,201,122,${(burst.v * 0.18).toFixed(3)})`);
        bg.addColorStop(0.35, `rgba(201,168,76,${(burst.v * 0.08).toFixed(3)})`);
        bg.addColorStop(0.7, `rgba(138,110,48,${(burst.v * 0.03).toFixed(3)})`);
        bg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      }

      // ── 5. STARS ──
      for (const p of pts) {
        if (!('layer' in p)) continue;
        p.x = (p.x + p.vx + 100) % 100;
        p.y = (p.y + p.vy + 100) % 100;
        const pulse = 0.55 + Math.sin(t * p.sp * 2 + p.ph) * 0.45;
        const bdx = (p.x/100 - burst.cx) * W, bdy = (p.y/100 - burst.cy) * H;
        const burstBoost = burst.v * Math.max(0, 1 - Math.sqrt(bdx*bdx+bdy*bdy)/500);
        const op = Math.min(0.92, p.op * pulse + burstBoost * 0.8);

        const layer = (p as typeof p & {layer:number}).layer;

        if (layer === 2) {
          // Foreground: large glowing star with corona
          const coronaR = p.r * (6 + burstBoost * 10);
          const gr = ctx.createRadialGradient(p.x*W/100, p.y*H/100, 0, p.x*W/100, p.y*H/100, coronaR);
          gr.addColorStop(0, `rgba(255,245,200,${op})`);
          gr.addColorStop(0.15, `rgba(232,201,122,${op * 0.7})`);
          gr.addColorStop(0.5, `rgba(201,168,76,${op * 0.2})`);
          gr.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath(); ctx.arc(p.x*W/100, p.y*H/100, coronaR, 0, Math.PI*2);
          ctx.fillStyle = gr; ctx.fill();
          // Core
          ctx.beginPath(); ctx.arc(p.x*W/100, p.y*H/100, p.r * (1 + burstBoost * 0.5), 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,250,220,${op})`; ctx.fill();
        } else if (layer === 1) {
          // Mid: warm gold with soft glow
          if (pulse > 0.8) {
            const gr2 = ctx.createRadialGradient(p.x*W/100, p.y*H/100, 0, p.x*W/100, p.y*H/100, p.r * 4);
            gr2.addColorStop(0, `rgba(232,201,122,${op * 0.6})`);
            gr2.addColorStop(1, "rgba(0,0,0,0)");
            ctx.beginPath(); ctx.arc(p.x*W/100, p.y*H/100, p.r*4, 0, Math.PI*2);
            ctx.fillStyle = gr2; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(p.x*W/100, p.y*H/100, p.r * (1 + burstBoost * 0.4), 0, Math.PI*2);
          ctx.fillStyle = `rgba(220,185,100,${op})`; ctx.fill();
        } else {
          // Deep: tiny dim stars, cool white-gold
          ctx.beginPath(); ctx.arc(p.x*W/100, p.y*H/100, p.r * (1 + burstBoost * 0.3), 0, Math.PI*2);
          ctx.fillStyle = `rgba(200,175,110,${op})`; ctx.fill();
        }
      }

      // ── 6. SHOOTING STARS ──
      if (shooters?.length) {
        for (const s of shooters) {
          if (!s.active) {
            s.timer -= dt;
            if (s.timer <= 0) {
              // Spawn from left/top edge heading right-downward
              s.x = Math.random() * W * 0.6;
              s.y = Math.random() * H * 0.5;
              s.vx = 4 + Math.random() * 5;
              s.vy = 1 + Math.random() * 2.5;
              s.len = 60 + Math.random() * 100;
              s.op = 0.7 + Math.random() * 0.3;
              s.active = true;
              s.timer = 6000 + Math.random() * 12000;
            }
            continue;
          }
          s.x += s.vx; s.y += s.vy;
          s.op -= 0.012;
          if (s.op <= 0 || s.x > W + 50 || s.y > H + 50) { s.active = false; continue; }
          const tailX = s.x - (s.vx / Math.sqrt(s.vx*s.vx+s.vy*s.vy)) * s.len;
          const tailY = s.y - (s.vy / Math.sqrt(s.vx*s.vx+s.vy*s.vy)) * s.len;
          const streak = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
          streak.addColorStop(0, "rgba(255,245,200,0)");
          streak.addColorStop(0.7, `rgba(232,201,122,${(s.op * 0.4).toFixed(3)})`);
          streak.addColorStop(1, `rgba(255,250,220,${s.op.toFixed(3)})`);
          ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = streak; ctx.lineWidth = 1.5; ctx.stroke();
          // Head glow
          const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 8);
          hg.addColorStop(0, `rgba(255,250,220,${s.op})`);
          hg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI*2);
          ctx.fillStyle = hg; ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  const triggerBurst = (cx: number, cy: number, v: number) => {
    burstRef.current = { v, cx, cy };
  };

  // Sequence engine
  const runCycle = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const cycle: Cycle = SEARCH_CYCLES[cycleIdxRef.current % SEARCH_CYCLES.length];
    cycleIdxRef.current++;
    const top = cycle.leads[0];

    // Reset
    setQueryText(""); setScanning(false); setLeads([]); setShowResultsHead(false);
    setLeadCount(0); setShowRing(false); setRingScore(0); setRingOffset(226);
    setTopLead(null); setShowBars(false); setBarFit(0); setBarOpp(0); setBarRisk(0);
    setShowAiMsg(false); setAiMsgText(""); setAiMsgFull(""); setAiMsgDone(false);
    setFooterHint("Analysing signals…");

    // 1. Type query
    let charIdx = 0;
    function typeChar() {
      charIdx++;
      setQueryText(cycle.q.slice(0, charIdx));
      if (charIdx < cycle.q.length) {
        const t = setTimeout(typeChar, 55);
        timersRef.current.push(t);
      } else {
        setScanning(true);
        triggerBurst(0.5, 0.6, 0.4);
        const t = setTimeout(showLeads, 600);
        timersRef.current.push(t);
      }
    }
    typeChar();

    // 2. Show leads
    function showLeads() {
      setShowResultsHead(true);
      setLeadCount(cycle.leads.length);
      cycle.leads.forEach((l, idx) => {
        const t = setTimeout(() => {
          setLeads(prev => [...prev, l]);
          if (idx === 0) triggerBurst(0.35, 0.6, 0.6);
        }, idx * 320);
        timersRef.current.push(t);
      });
      const t = setTimeout(showScore, cycle.leads.length * 320 + 600);
      timersRef.current.push(t);
    }

    // 3. Score reveal
    function showScore() {
      setTopLead(top);
      setShowRing(true);
      setRingColor(top.sc);
      setRingOffset(226 * (1 - top.score / 100));
      triggerBurst(0.68, 0.55, 1.0);
      // Animate ring number
      const start = performance.now();
      function animRing(now: number) {
        const p = Math.min(1, (now - start) / 1100);
        setRingScore(Math.round(top.score * p*p*(3-2*p)));
        if (p < 1) requestAnimationFrame(animRing);
      }
      requestAnimationFrame(animRing);
      const t1 = setTimeout(() => {
        setShowBars(true);
        setBarFit(top.fit); setBarOpp(top.opp); setBarRisk(top.risk);
      }, 300);
      const t2 = setTimeout(showMsg, 1400);
      timersRef.current.push(t1, t2);
    }

    // 4. AI message
    function showMsg() {
      setShowAiMsg(true);
      triggerBurst(0.68, 0.7, 0.5);
      const fullHtml = top.msg ? top.msg(top.n) : "";
      const plain = fullHtml.replace(/<[^>]+>/g, "");
      setAiMsgFull(fullHtml);
      let mi = 0;
      function typeMsg() {
        mi++;
        setAiMsgText(plain.slice(0, mi));
        if (mi <= plain.length) {
          const t = setTimeout(typeMsg, 32);
          timersRef.current.push(t);
        } else {
          const t = setTimeout(() => setAiMsgDone(true), 300);
          timersRef.current.push(t);
        }
      }
      typeMsg();
      setFooterHint(cycle.hint);
      const t = setTimeout(runCycle, 9500);
      timersRef.current.push(t);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(runCycle, 800);
    return () => {
      clearTimeout(t);
      timersRef.current.forEach(clearTimeout);
    };
  }, [runCycle]);

  const ringCircumference = 226;

  return (
    <section style={{
      position: "relative",
      width: "100vw",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#060608",
      overflow: "hidden",
    }}>
      {/* Canvas — particle field covers whole section */}
      <canvas ref={canvasRef} style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Headline */}
      <div style={{
        position: "relative", zIndex: 10,
        textAlign: "center",
        marginBottom: 52,
        animation: "fadeUp 1.2s cubic-bezier(0.16,1,0.3,1) 0.2s both",
      }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.24em", color: "rgba(201,168,76,0.35)",
          textTransform: "uppercase", fontFamily: "monospace", marginBottom: 18,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        }}>
          <span style={{ display: "block", width: 28, height: 1, background: "rgba(201,168,76,0.2)" }} />
          Signal-Driven Lead Intelligence
          <span style={{ display: "block", width: 28, height: 1, background: "rgba(201,168,76,0.2)" }} />
        </div>
        <h2 style={{
          fontFamily: "var(--font-display), serif",
          fontSize: "clamp(32px,4vw,58px)",
          fontWeight: 300, color: "#f0e8d8",
          letterSpacing: "-0.025em", lineHeight: 1.1,
          marginBottom: 4,
        }}>
          The intelligence layer
        </h2>
        <h2 style={{
          fontFamily: "var(--font-display), serif",
          fontSize: "clamp(32px,4vw,58px)",
          fontWeight: 600, fontStyle: "italic",
          letterSpacing: "-0.025em", lineHeight: 1.1,
          textAlign: "right",
          background: "linear-gradient(135deg,#e8c97a,#c9a84c,#8a6e30)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 16px rgba(201,168,76,0.3))",
        }}>
          your outreach is missing.
        </h2>
        <p style={{
          fontSize: 13, color: "#303040",
          marginTop: 16, maxWidth: 460,
          marginLeft: "auto", marginRight: "auto",
          lineHeight: 1.7,
        }}>
          Vantio finds local businesses and tells you exactly which ones are worth contacting — scored against your service, capability, and style.
        </p>
      </div>

      {/* Dashboard */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "min(1020px,90vw)",
        animation: "fadeUp 1.2s cubic-bezier(0.16,1,0.3,1) 0.5s both",
      }}>
        <div style={{
          background: "rgba(8,8,14,0.96)",
          border: "1px solid rgba(201,168,76,0.13)",
          borderRadius: 16, overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(201,168,76,0.05), 0 24px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}>
          {/* Gold accent line */}
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent 5%,rgba(201,168,76,0.35) 50%,transparent 95%)" }} />

          {/* Chrome bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "11px 18px", background: "rgba(5,5,10,0.8)",
            borderBottom: "1px solid rgba(201,168,76,0.07)",
          }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#141420" }} />)}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontSize: 8, color: "rgba(201,168,76,0.25)" }}>◈</span>
              <span style={{ fontSize: 9, color: "#1e1e2c", fontFamily: "monospace", letterSpacing: "0.04em" }}>vantioapp.com — Lead Scanner</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", animation: "pulse 1.4s infinite" }} />
              <span style={{ fontSize: 8, color: "#4ade80", fontFamily: "monospace", letterSpacing: "0.08em" }}>SCANNING</span>
            </div>
          </div>

          {/* Two-column body */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 300 }}>
            {/* LEFT: search + leads */}
            <div style={{ padding: "18px 20px", borderRight: "1px solid rgba(201,168,76,0.06)" }}>
              {/* Search bar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${scanning ? "rgba(201,168,76,0.3)" : "rgba(201,168,76,0.1)"}`,
                borderRadius: 8, padding: "9px 13px", marginBottom: 14,
                transition: "border-color 0.3s",
                boxShadow: scanning ? "0 0 12px rgba(201,168,76,0.15)" : "none",
              }}>
                <span style={{ fontSize: 12, color: "#c9a84c" }}>🔍</span>
                <span style={{ flex: 1, fontSize: 12, color: "#c0b8a8", minHeight: 15 }}>{queryText}</span>
                <span style={{ display: "inline-block", width: 2, height: 13, background: "#c9a84c", verticalAlign: "middle", animation: "blink 0.9s infinite" }} />
                <div style={{
                  padding: "4px 11px", background: "#c9a84c", color: "#080808",
                  fontSize: 8, fontWeight: 700, borderRadius: 5,
                  fontFamily: "monospace", letterSpacing: "0.08em",
                  boxShadow: scanning ? "0 0 12px rgba(201,168,76,0.4)" : "none",
                  transition: "box-shadow 0.3s",
                }}>SCAN</div>
              </div>

              {/* Results header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 6, marginBottom: 9,
                opacity: showResultsHead ? 1 : 0, transition: "opacity 0.4s",
              }}>
                <span style={{ fontSize: 8, color: "#1e1e2c", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace" }}>Results</span>
                <span style={{ fontSize: 8, color: "#c9a84c", fontWeight: 700, fontFamily: "monospace" }}>{leadCount}</span>
                <span style={{ fontSize: 8, color: "#1e1e2c", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "monospace" }}>leads</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 3 }}>
                  {["Score ↓","Gap","Fit"].map(f => (
                    <span key={f} style={{ fontSize: 7, padding: "1px 6px", border: "1px solid #181828", borderRadius: 3, color: "#181828", fontFamily: "monospace" }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* Leads list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {leads.map((l, idx) => (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 11px", borderRadius: 8,
                    background: idx === 0 ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.015)",
                    border: `1px solid ${idx === 0 ? "rgba(201,168,76,0.22)" : "rgba(255,255,255,0.04)"}`,
                    boxShadow: idx === 0 ? "0 0 20px rgba(201,168,76,0.06)" : "none",
                    animation: "leadIn 0.35s ease both",
                  }}>
                    <span style={{ fontSize: 8, fontFamily: "monospace", color: idx === 0 ? "#c9a84c" : "#181828", minWidth: 18 }}>
                      {String(idx+1).padStart(2,"0")}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: idx === 0 ? "#d8d0c0" : "#b0a898" }}>{l.n}</span>
                    <span style={{ fontSize: 7, padding: "1px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: l.gc + "18", color: l.gc }}>{l.gap}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, minWidth: 28, textAlign: "right", color: l.sc }}>{l.score}</span>
                    <span style={{ fontSize: 7, padding: "1px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: l.vc + "18", color: l.vc, minWidth: 44, textAlign: "center" }}>{l.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: score ring + bars + AI message */}
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 8, color: "rgba(201,168,76,0.3)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 16 }}>
                Top Match — Intelligence Report
              </div>

              {/* Score ring + lead info */}
              <div style={{
                display: "flex", alignItems: "center", gap: 20, marginBottom: 18,
                opacity: showRing ? 1 : 0, transition: "opacity 0.5s",
              }}>
                <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 90 90" width="90" height="90" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                    <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
                    <circle cx="45" cy="45" r="36" fill="none"
                      stroke={ringColor} strokeWidth="6" strokeLinecap="round"
                      strokeDasharray="226" strokeDashoffset={ringOffset}
                      style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1), stroke 0.4s" }}
                    />
                  </svg>
                  <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "monospace", color: ringColor, position: "relative", zIndex: 1 }}>{ringScore}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#d8d0c0", marginBottom: 4 }}>{topLead?.n}</div>
                  <div style={{ fontSize: 8, color: "#222232", fontFamily: "monospace", marginBottom: 10 }}>Intelligence Report</div>
                  {topLead && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      fontSize: 8, padding: "3px 9px", borderRadius: 4,
                      fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase",
                      background: topLead.gc + "20", border: `1px solid ${topLead.gc}40`, color: topLead.gc,
                    }}>⬡ {topLead.gap} GAP DETECTED</span>
                  )}
                </div>
              </div>

              {/* Score bars */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, opacity: showBars ? 1 : 0, transition: "opacity 0.5s 0.2s" }}>
                {[
                  { label: "Fit Score",   val: barFit,  color: "#818cf8", id: "fit"  },
                  { label: "Opportunity", val: barOpp,  color: "#4ade80", id: "opp"  },
                  { label: "Risk Index",  val: barRisk, color: "#f87171", id: "risk" },
                ].map(bar => (
                  <div key={bar.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 8, color: "#1c1c2c", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>{bar.label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "monospace", color: bar.color }}>{bar.val || "—"}</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", background: bar.color, borderRadius: 99,
                        width: showBars ? `${bar.val}%` : "0%",
                        transition: "width 1.1s cubic-bezier(0.16,1,0.3,1)",
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* AI message */}
              <div style={{
                marginTop: 14, padding: "11px 13px",
                background: "rgba(201,168,76,0.03)",
                border: "1px solid rgba(201,168,76,0.1)",
                borderRadius: 8,
                opacity: showAiMsg ? 1 : 0,
                transition: "opacity 0.5s 0.4s",
              }}>
                <div style={{ fontSize: 7, color: "rgba(201,168,76,0.3)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "monospace", marginBottom: 7 }}>
                  ◈ AI Outreach — Generated
                </div>
                <div style={{ fontSize: 10.5, color: "#252535", lineHeight: 1.65 }}>
                  {aiMsgDone
                    ? <span dangerouslySetInnerHTML={{ __html: aiMsgFull.replace(/<em>/g,'<em style="color:#c9a84c;font-style:normal">').replace(/<strong>/g,'<strong style="color:#8080a0">') }} />
                    : <>{aiMsgText}<span style={{ display: "inline-block", width: 2, height: 11, background: "#c9a84c", verticalAlign: "middle", animation: "blink 0.9s infinite" }} /></>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 20px",
            borderTop: "1px solid rgba(201,168,76,0.06)",
            background: "rgba(5,5,10,0.5)",
          }}>
            <span style={{ fontSize: 8, color: "#1a1a28", letterSpacing: "0.1em", fontFamily: "monospace" }}>{footerHint}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <div style={{ fontSize: 8, padding: "5px 12px", borderRadius: 5, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.06em", background: "transparent", border: "1px solid rgba(201,168,76,0.15)", color: "rgba(201,168,76,0.35)" }}>Save Lead</div>
              <div style={{ fontSize: 8, padding: "5px 12px", borderRadius: 5, fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.06em", background: "#c9a84c", color: "#080808" }}>Send Outreach</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}




// Gold text with constant ambient glow
function GoldText({ children, style = {}, as: Tag = "span" }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  as?: any;
}) {
  return (
    <Tag style={{ ...style, filter: "drop-shadow(0 0 8px rgba(201,168,76,0.45)) drop-shadow(0 0 20px rgba(201,168,76,0.18))" }}>
      {children}
    </Tag>
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



  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);











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
      />

      {/* STAT BAR */}
      <StatBar />

      {/* Section boundary glow */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.18), transparent)", position: "relative", margin: "0" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "80%", height: 160, background: "radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.09) 0%, transparent 65%)", pointerEvents: "none" }} />
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
            <GoldText as="p" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>What Vantio does</GoldText>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300 }}>
              Not a lead list.{" "}
              <GoldText as="em" style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lead intelligence.</GoldText>
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
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "70%", height: 160, background: "radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
      </div>

      <div ref={stepsRef}>
        <section id="how-it-works" style={{ padding: "112px 48px", maxWidth: 960, margin: "0 auto" }}>
          <div style={{ marginBottom: 64, textAlign: "center", opacity: stepsVisible ? 1 : 0, transform: stepsVisible ? "none" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <GoldText as="p" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>The process</GoldText>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300 }}>
              From search to{" "}
              <GoldText as="em" style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>signed client.</GoldText>
            </h2>
          </div>
          <StepsSection visible={stepsVisible} scrollY={scrollY} />
        </section>
      </div>

      {/* Section boundary glow */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent)", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "85%", height: 180, background: "radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.10) 0%, transparent 65%)", pointerEvents: "none" }} />
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
                <GoldText as="p" style={{ fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 20 }}>Why Vantio is different</GoldText>
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
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.15), transparent)", position: "relative" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "70%", height: 160, background: "radial-gradient(ellipse at 50% 50%, rgba(201,168,76,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
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
            <GoldText as="p" style={{
              fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 32,
              opacity: ctaVisible ? 1 : 0, transition: "opacity 0.8s ease",
            }}>
              Join the beta
            </GoldText>

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
              <GoldText as="em" style={{ fontStyle: "italic", fontWeight: 600, background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 45%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Start converting.
              </GoldText>
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
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes leadIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: none; }
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
