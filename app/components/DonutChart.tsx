"use client";

type Segment = { value: number; color: string };

export default function DonutChart({
  segments,
  total,
  size = 140,
}: {
  segments: Segment[];
  total: number;
  size?: number;
}) {
  const strokeWidth = size * 0.14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAccum = 0;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1a1a1a" strokeWidth={strokeWidth} />
        {total > 0 &&
          segments.map((seg, i) => {
            const fraction = seg.value / total;
            const dashLength = circumference * fraction;
            const dashOffset = circumference * (1 - offsetAccum);
            offsetAccum += fraction;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${circumference}`}
                strokeDashoffset={dashOffset}
              />
            );
          })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}>
        <span style={{ fontSize: size * 0.19, fontWeight: 600, color: "#f5f0e8" }}>{total}</span>
      </div>
    </div>
  );
}
