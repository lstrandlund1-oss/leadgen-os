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
        setTriggered(true);
        setCounts([0, 0, 0, 0]);
        setShimmer(false);
        setTimeout(() => setShimmer(true), 200);
      } else {
        // Reset when fully scrolled away so it replays on scroll back up
        setTriggered(false);
        setShimmer(false);
        setCounts([0, 0, 0, 0]);
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

export default function LandingPage() {
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [cardAnimate, setCardAnimate] = useState(false);
  const [chipsVisible, setChipsVisible] = useState(false);
  const [scanPos, setScanPos] = useState(-10);
  const [tick, setTick] = useState(0);

  // Two particle layers for galaxy depth effect
  const [nearParticles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 120,
      size: Math.random() * 1.5 + 0.4,
      duration: Math.random() * 10 + 6, delay: Math.random() * 8,
      opacity: Math.random() * 0.2 + 0.04,
      driftX: (Math.random() - 0.5) * 0.03,
    }))
  );
  const [deepParticles] = useState(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i + 100, x: Math.random() * 100, y: Math.random() * 120,
      size: Math.random() * 3 + 1.5,
      duration: Math.random() * 18 + 12, delay: Math.random() * 10,
      baseOpacity: Math.random() * 0.12 + 0.02,
      rotationOffset: Math.random() * 360,
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

  useEffect(() => {
    const t1 = setTimeout(() => setCardAnimate(true), 800);
    const t2 = setTimeout(() => setChipsVisible(true), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // RAF ticker for chip orbit animation
  useEffect(() => {
    let raf: number;
    const animate = () => { setTick(t => t + 1); raf = requestAnimationFrame(animate); };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Scanning line RAF
  useEffect(() => {
    if (!cardAnimate) return;
    let pos = -10;
    let raf: number;
    const animate = () => { pos += 0.5; if (pos > 110) pos = -10; setScanPos(pos); raf = requestAnimationFrame(animate); };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [cardAnimate]);

  const scrollProgress = Math.min(1, scrollY / 500);
  const cardScatter = Math.min(1, scrollY / 400);
  const cardFloat = -scrollY * 0.10;
  const cardRotate = Math.min(scrollY * 0.006, 4);
  const cardScale = 1 - cardScatter * 0.06;
  const heroTextOpacity = Math.max(0, 1 - scrollY * 0.003);
  // Galaxy depth — particles grow and brighten as user scrolls
  const galaxyDepth = Math.min(1, scrollY / 800);
  // Slow field rotation driven by scroll
  const fieldRotation = scrollY * 0.015;

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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/plans" style={{ fontSize: 13, color: "#555", textDecoration: "none", letterSpacing: "0.06em" }}>Pricing</Link>
          <Link href="/login" style={{ fontSize: 13, padding: "8px 18px", borderRadius: 8, border: "1px solid rgba(201,168,76,0.3)", color: "#c9a84c", textDecoration: "none", letterSpacing: "0.06em" }}>Get Early Access</Link>
          <HamburgerMenu hasProfile={false} />
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", textAlign: "center", overflow: "hidden" }}>

        {/* Ambient glow */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(201,168,76,0.1) 0%, transparent 65%)" }} />

        {/* Scrolling grid */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.018, backgroundImage: "linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)", backgroundSize: "72px 72px", transform: `translateY(${scrollY * 0.08}px)` }} />

        {/* ── GALAXY PARTICLE SYSTEM ── */}
        {/* Near layer — small ambient particles */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: `rotate(${fieldRotation}deg)`, transformOrigin: "50% 40%" }}>
          {nearParticles.map(p => (
            <div key={p.id} style={{
              position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
              width: p.size + galaxyDepth * 0.8,
              height: p.size + galaxyDepth * 0.8,
              borderRadius: "50%", background: "#c9a84c",
              opacity: p.opacity + galaxyDepth * 0.15,
              animation: `particleDrift ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }} />
          ))}
        </div>

        {/* Deep layer — larger gold stars that intensify with scroll */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: `rotate(${-fieldRotation * 0.4}deg)`, transformOrigin: "50% 40%" }}>
          {deepParticles.map(p => (
            <div key={p.id} style={{
              position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
              width: p.size * (1 + galaxyDepth * 1.2),
              height: p.size * (1 + galaxyDepth * 1.2),
              borderRadius: "50%",
              background: `radial-gradient(circle, #e8c97a 0%, #c9a84c 60%, transparent 100%)`,
              opacity: p.baseOpacity + galaxyDepth * 0.35,
              animation: `starPulse ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
              boxShadow: galaxyDepth > 0.3 ? `0 0 ${4 + galaxyDepth * 8}px rgba(201,168,76,${galaxyDepth * 0.4})` : "none",
            }} />
          ))}
        </div>

        { /* Hero text group — fades out on scroll */ }
        <div style={{ opacity: heroTextOpacity, transform: `translateY(${scrollY * -0.04}px)`, transition: "opacity 0.05s linear", pointerEvents: heroTextOpacity < 0.05 ? "none" : "auto", width: "100%" }}>
        {/* Badge */}
        <div className="animate-fade-up-delay-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, border: "1px solid rgba(201,168,76,0.25)", background: "rgba(201,168,76,0.04)", marginBottom: 32 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c9a84c", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#c9a84c" }}>
            {waitlistCount !== null ? `${waitlistCount} service providers in early access` : "Closed Beta — Limited Access"}
          </span>
        </div>

        {/* Headline */}
        <h1 className="animate-fade-up-delay-2" style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(42px, 8vw, 86px)", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: 900, margin: "0 auto 32px" }}>
          The intelligence layer
          <br />
          <em style={{ fontStyle: "italic", fontWeight: 600, background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            your outreach is missing.
          </em>
        </h1>

        <p className="animate-fade-up-delay-3" style={{ fontSize: 16, color: "#666", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7, letterSpacing: "0.02em" }}>
          Vantio finds local businesses and tells you exactly which ones are worth contacting — scored against your specific service, capability, and style.
        </p>

        <div className="animate-fade-up-delay-4" style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", marginBottom: 64 }}>
          <Link href="/login" style={{ padding: "14px 32px", borderRadius: 10, background: "#c9a84c", color: "#080808", fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", textDecoration: "none", boxShadow: "0 8px 40px rgba(201,168,76,0.22)" }}>
            Request Early Access
          </Link>
          <Link href="#how-it-works" style={{ fontSize: 13, color: "#555", textDecoration: "none", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 8 }}>
            See how it works <span style={{ color: "#8a6e30" }}>↓</span>
          </Link>
        </div>
        </div>{/* end hero text fade wrapper */}

        {/* ── HERO CARD + ORBITAL CHIPS ── */}
        <div className="animate-fade-up-delay-5" style={{ position: "relative", width: "100%", maxWidth: 460, margin: "0 auto" }}>

          {/* ORBITAL FEATURE CHIPS */}
          {ORBITAL_CHIPS.map((chip, i) => {
            const angleRad = (chip.angle * Math.PI) / 180;
            // Gentle floating using tick — each chip drifts independently
            const floatOffset = Math.sin(tick * chip.driftSpeed + i * 1.2) * 8;
            const floatX = Math.cos(tick * chip.driftSpeed * 0.7 + i) * 4;
            // Scatter outward on scroll
            const scatterMultiplier = 1 + cardScatter * 0.5;
            const x = Math.cos(angleRad) * chip.radius * scatterMultiplier;
            const y = Math.sin(angleRad) * chip.radius * scatterMultiplier + floatOffset;
            // Scroll parallax — chips at different depths move at different rates
            const parallaxY = scrollY * (0.04 + i * 0.015) * (i % 2 === 0 ? 1 : -1);

            return (
              <div key={chip.label} style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x + floatX}px), calc(-50% + ${y + parallaxY}px))`,
                opacity: chipsVisible ? Math.max(0, 1 - scrollProgress * 0.6) : 0,
                transition: chipsVisible
                  ? `opacity 0.8s ease ${chip.delay}ms, transform 0.05s linear`
                  : `opacity 0.8s ease ${chip.delay}ms`,
                pointerEvents: "none",
                zIndex: 2,
                whiteSpace: "nowrap",
              }}>
                <div style={{
                  background: "rgba(10,10,10,0.92)",
                  border: `1px solid ${chip.color}30`,
                  borderRadius: 12,
                  padding: "8px 12px",
                  backdropFilter: "blur(8px)",
                  boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${chip.color}15`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: chip.color }}>{chip.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#e8e0d0", letterSpacing: "0.02em" }}>{chip.label}</span>
                  </div>
                  <p style={{ fontSize: 9, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>{chip.sub}</p>
                </div>
                {/* Connector line from chip to card */}
                <div style={{
                  position: "absolute",
                  width: 1,
                  height: Math.abs(y) * 0.3,
                  background: `linear-gradient(${y > 0 ? "to top" : "to bottom"}, transparent, ${chip.color}20)`,
                  left: "50%",
                  top: y > 0 ? "auto" : "100%",
                  bottom: y > 0 ? "100%" : "auto",
                  transform: "translateX(-50%)",
                  opacity: 0.5,
                }} />
              </div>
            );
          })}

          {/* MAIN SCORE CARD */}
          <div style={{
            borderRadius: 20,
            border: "1px solid #1e1e1e",
            background: "#0d0d0d",
            padding: 22,
            textAlign: "left",
            boxShadow: "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.06)",
            transform: `translateY(${cardFloat}px) rotateX(${cardRotate}deg) scale(${cardScale})`,
            transformStyle: "preserve-3d",
            transition: "transform 0.08s linear",
            position: "relative",
            overflow: "hidden",
            zIndex: 3,
          }}>
            {/* Scanning line */}
            <div style={{ position: "absolute", left: 0, right: 0, top: `${scanPos}%`, height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)", pointerEvents: "none" }} />
            {/* Corner glow */}
            <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#f5f0e8" }}>{MOCK_LEAD.name}</p>
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, border: "1px solid #252525", color: "#555" }}>{MOCK_LEAD.industry}</span>
                </div>
                <p style={{ fontSize: 11, color: "#444" }}>📍 {MOCK_LEAD.city}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, color: MOCK_LEAD.verdictColor, background: `${MOCK_LEAD.verdictColor}14`, border: `1px solid ${MOCK_LEAD.verdictColor}30` }}>
                {MOCK_LEAD.verdict}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 16 }}>
              <ScoreBar label="Score" value={MOCK_LEAD.score} color="#c9a84c" delay={900} animate={cardAnimate} />
              <ScoreBar label="Fit" value={MOCK_LEAD.fit} color="#4ade80" delay={1100} animate={cardAnimate} />
              <ScoreBar label="Opportunity" value={MOCK_LEAD.opportunity} color="#818cf8" delay={1300} animate={cardAnimate} />
              <ScoreBar label="Risk" value={MOCK_LEAD.risk} color="#f87171" delay={1500} animate={cardAnimate} />
            </div>

            <div style={{ borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, background: `${MOCK_LEAD.gapColor}08`, border: `1px solid ${MOCK_LEAD.gapColor}20`, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MOCK_LEAD.gapColor }}>⬡ {MOCK_LEAD.gap} GAP</span>
              <span style={{ fontSize: 10, color: "#555" }}>— no booking flow detected</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4, border: "1px solid #1a1a1a", borderRadius: 14, background: "#0a0a0a", padding: "10px 8px" }}>
              {[
                { label: "Contacted", value: "12", icon: "✉", color: "#4ade80" },
                { label: "Replied", value: "5", icon: "↩", color: "#4ade80" },
                { label: "Calls", value: "2", icon: "📅", color: "#4ade80" },
                { label: "Closed", value: "1", icon: "✦", color: "#c9a84c" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 11, color: item.color }}>{item.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#f5f0e8" }}>{item.value}</span>
                  <span style={{ fontSize: 9, color: "#444", letterSpacing: "0.05em" }}>{item.label}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 10, color: "#2a2a2a", textAlign: "center", marginTop: 12, letterSpacing: "0.18em", textTransform: "uppercase" }}>Live intelligence · scored in seconds</p>
          </div>

          {/* Card underglow */}
          <div style={{ position: "absolute", bottom: -30, left: "10%", right: "10%", height: 60, background: "radial-gradient(ellipse, rgba(201,168,76,0.14) 0%, transparent 70%)", pointerEvents: "none", filter: "blur(14px)", transform: `scale(${1 + cardScatter * 0.3})`, transition: "transform 0.1s linear" }} />
        </div>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: Math.max(0, 1 - scrollY / 200) }}>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, rgba(201,168,76,0.4))" }} />
          <span style={{ fontSize: 9, color: "#333", letterSpacing: "0.2em", textTransform: "uppercase" }}>scroll</span>
        </div>
      </section>

      {/* STAT BAR */}
      <StatBar />

      {/* FEATURES */}
      <div ref={featuresRef}>
        <section style={{ padding: "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 64, textAlign: "center", opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? "none" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>What Vantio does</p>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300 }}>
              Not a lead list.{" "}
              <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Lead intelligence.</em>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ padding: 28, borderRadius: 18, border: "1px solid #151515", background: "#0d0d0d", opacity: featuresVisible ? 1 : 0, transform: featuresVisible ? "none" : "translateY(40px)", transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms`, cursor: "default" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,168,76,0.2)"; (e.currentTarget as HTMLElement).style.background = "#101010"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#151515"; (e.currentTarget as HTMLElement).style.background = "#0d0d0d"; }}
              >
                <div style={{ fontSize: 20, color: "#4a3a1a", marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontFamily: "var(--font-display), serif", fontSize: 18, fontWeight: 500, marginBottom: 10, color: "#e8e0d0" }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.12), transparent)" }} />
      </div>

      {/* HOW IT WORKS */}
      <div ref={stepsRef}>
        <section id="how-it-works" style={{ padding: "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 64, textAlign: "center", opacity: stepsVisible ? 1 : 0, transform: stepsVisible ? "none" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>The process</p>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300 }}>
              From search to{" "}
              <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>signed client.</em>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 24 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 24, padding: 24, borderRadius: 18, border: "1px solid #111", opacity: stepsVisible ? 1 : 0, transform: stepsVisible ? "none" : "translateY(40px)", transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms` }}>
                <div style={{ flexShrink: 0 }}>
                  <span style={{ fontFamily: "var(--font-display), serif", fontSize: 52, fontWeight: 300, color: "#1a1a1a", lineHeight: 1 }}>{s.number}</span>
                </div>
                <div style={{ paddingTop: 8 }}>
                  <h3 style={{ fontFamily: "var(--font-display), serif", fontSize: 18, fontWeight: 500, marginBottom: 8, color: "#e8e0d0" }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* DIFFERENTIATOR */}
      <div ref={diffRef}>
        <section style={{ padding: "96px 24px", background: "#060606", borderTop: "1px solid #111", borderBottom: "1px solid #111" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ marginBottom: 56, textAlign: "center", opacity: diffVisible ? 1 : 0, transform: diffVisible ? "none" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
              <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 16 }}>Why Vantio is different</p>
              <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 300 }}>
                Other tools give you names.{" "}
                <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>We give you reasons.</em>
              </h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "#151515", borderRadius: 18, overflow: "hidden", border: "1px solid #151515", opacity: diffVisible ? 1 : 0, transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.2s" }}>
              {[
                { label: "Typical lead lists", icon: "✗", iconColor: "#f87171", highlight: false, points: ["Name, phone, address", "No scoring or context", "Same list for everyone", "Manual research required", "No outreach guidance"] },
                { label: "Vantio", icon: "◈", iconColor: "#c9a84c", highlight: true, points: ["Signal-driven lead score", "Gap type + pitch angle", "Matched to your profile", "Website signals auto-scanned", "AI message from your profile"] },
                { label: "Manual research", icon: "✗", iconColor: "#f87171", highlight: false, points: ["1–2 hours per lead", "Inconsistent judgment", "No structured scoring", "Easy to miss signals", "Hard to scale"] },
              ].map((col, i) => (
                <div key={i} style={{ padding: 28, background: col.highlight ? "rgba(201,168,76,0.04)" : "#0a0a0a" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                    <span style={{ fontSize: 16, color: col.iconColor }}>{col.icon}</span>
                    <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.04em", color: col.highlight ? "#c9a84c" : "#444" }}>{col.label}</p>
                    {col.highlight && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 999, background: "rgba(201,168,76,0.15)", color: "#c9a84c", letterSpacing: "0.1em", textTransform: "uppercase", marginLeft: "auto" }}>You are here</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {col.points.map((pt, j) => (
                      <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ fontSize: 10, color: col.highlight ? "#4ade80" : "#333", flexShrink: 0, marginTop: 1 }}>{col.highlight ? "✓" : "—"}</span>
                        <p style={{ fontSize: 12, lineHeight: 1.5, color: col.highlight ? "#888" : "#333" }}>{pt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* CTA */}
      <div ref={ctaRef}>
        <section style={{ padding: "96px 24px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", borderRadius: 24, border: "1px solid rgba(201,168,76,0.15)", background: "#0d0d0d", padding: "72px 48px", textAlign: "center", position: "relative", overflow: "hidden", opacity: ctaVisible ? 1 : 0, transform: ctaVisible ? "none" : "translateY(40px)", transition: "all 0.9s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(201,168,76,0.05) 0%, transparent 70%)" }} />
            <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8a6e30", marginBottom: 24 }}>Join the beta</p>
            <h2 style={{ fontFamily: "var(--font-display), serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 300, marginBottom: 24 }}>
              Stop guessing.<br />
              <em style={{ fontStyle: "italic", background: "linear-gradient(135deg, #e8c97a 0%, #c9a84c 50%, #8a6e30 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Start converting.</em>
            </h2>
            <p style={{ fontSize: 14, color: "#555", maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.7 }}>
              We&apos;re opening beta access to a limited number of service providers. Create your profile now and get matched leads from day one.
            </p>
            <Link href="/login" style={{ display: "inline-block", padding: "16px 40px", borderRadius: 12, background: "#c9a84c", color: "#080808", fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", textDecoration: "none", boxShadow: "0 8px 40px rgba(201,168,76,0.2)" }}>
              Create Your Profile — It&apos;s Free
            </Link>
            <p style={{ marginTop: 16, fontSize: 11, color: "#333" }}>No credit card required · Cancel anytime</p>
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
          <p style={{ fontSize: 11, color: "#222", letterSpacing: "0.06em" }}>© 2025 Vantio. All rights reserved.</p>
        </div>
      </footer>

      <style>{`
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
