"use client";

const COLORS = ["#c9a84c", "#7a6fd4", "#4a9d8f", "#d47a6f", "#6f9dd4", "#a3d46f"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function CompanyAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  const color = colorForName(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: `${color}22`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        flexShrink: 0,
      }}>
      {letter}
    </div>
  );
}
