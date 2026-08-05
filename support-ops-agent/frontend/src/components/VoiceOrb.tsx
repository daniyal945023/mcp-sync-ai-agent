"use client";

export default function VoiceOrb({
  state,
}: {
  state: "idle" | "listening" | "speaking";
}) {
  const active = state !== "idle";
  const color =
    state === "listening"
      ? "from-violet-500 via-fuchsia-400 to-violet-500"
      : "from-violet-500 via-indigo-400 to-violet-500";

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr ${color} blur-xl transition-all duration-500`}
        style={{
          opacity: active ? 0.9 : 0.35,
          transform: active ? "scale(1.15)" : "scale(0.9)",
          animation: active
            ? "orb-spin 2.5s linear infinite, orb-pulse 1s ease-in-out infinite"
            : "orb-spin 10s linear infinite",
        }}
      />
      <div
        className="relative w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 transition-transform duration-300"
        style={{ transform: active ? "scale(1.1)" : "scale(1)" }}
      />
    </div>
  );
}