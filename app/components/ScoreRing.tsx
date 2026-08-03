"use client";

export default function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  // Gold only for genuinely high scores — per the design system's own
  // principle that gold should communicate importance and stay sparing,
  // not become the default color for every number on the page.
  const color = clamped >= 80 ? "#c9a84c" : clamped >= 60 ? "#8a8a6e" : "#555";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a1a1a" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.32,
          fontWeight: 600,
          color,
        }}>
        {Math.round(clamped)}
      </div>
    </div>
  );
}
