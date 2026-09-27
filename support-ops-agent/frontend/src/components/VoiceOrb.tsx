"use client";

export default function VoiceOrb({
  state,
}: {
  state: "idle" | "listening" | "speaking";
}) {
  const active = state !== "idle";

  const glow =
    state === "listening"
      ? "from-[#ffaf7d] via-[#ea4d3a] to-[#6e1416]"
      : "from-[#ffaf7d] via-[#e8513d] to-[#6e1416]";

  return (
    <div className="relative flex h-20 w-20 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(255,149,98,0.52),_rgba(126,22,23,0.18)_32%,_transparent_72%)] blur-[18px]"
        style={{
          opacity: active ? 1 : 0.42,
          animation: active ? "orb-pulse 1.4s ease-in-out infinite" : "none",
        }}
      />

      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${glow} blur-xl`}
        style={{
          opacity: active ? 0.95 : 0.28,
          transform: active ? "scale(1.18)" : "scale(0.86)",
          animation: active
            ? "orb-spin 3.4s linear infinite, orb-pulse 1.3s ease-in-out infinite"
            : "orb-spin 12s linear infinite",
          boxShadow: active
            ? "0 0 26px rgba(161, 28, 25, 0.9), 0 0 52px rgba(255, 112, 68, 0.52)"
            : "0 0 14px rgba(161, 28, 25, 0.35)",
        }}
      />

      <div className="absolute inset-[11px] rounded-full border border-white/15 bg-[#0d0d12]/85 backdrop-blur-sm" />

      <div
        className="relative h-10 w-10 rounded-full border border-[#ffd8bb]/60 bg-[radial-gradient(circle_at_30%_30%,_#ffd8ba,_#ff9a67_18%,_#e94d3c_42%,_#5a0b12_100%)] shadow-[0_0_18px_rgba(255,120,75,0.72)] transition-transform duration-300"
        style={{
          transform: active ? "scale(1.08)" : "scale(1)",
        }}
      />

      <div className="absolute inset-0 rounded-full border border-[#ff9b76]/30" />
    </div>
  );
}