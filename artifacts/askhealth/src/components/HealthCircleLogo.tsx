import React, { useEffect, useState } from "react";

const LETTER_COLORS = [
  "#a855f7", // H – violet
  "#3b82f6", // E – blue
  "#06b6d4", // A – cyan
  "#10b981", // L – emerald
  "#f59e0b", // T – amber
  "#ef4444", // H – red
];

const LETTERS = ["H", "E", "A", "L", "T", "H"];

const RING_GRADIENT_ID = "hc-ring-grad";

interface Props {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  animate?: boolean;
}

export default function HealthCircleLogo({
  size = "md",
  showText = true,
  animate = true,
}: Props) {
  const [visible, setVisible] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [animate]);

  const isLg = size === "lg";
  const isSm = size === "sm";

  const iconSize = isLg ? 64 : isSm ? 32 : 44;
  const fontSize = isLg ? 28 : isSm ? 11 : 16;
  const strokeW = isLg ? 4 : isSm ? 2.5 : 3;
  const textSizeClass = isLg ? "text-3xl" : isSm ? "text-base" : "text-xl";
  const gapClass = isLg ? "gap-3" : isSm ? "gap-2" : "gap-2.5";

  const r = (iconSize / 2) - strokeW - 2;
  const cx = iconSize / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className={`inline-flex items-center ${gapClass}`}>
      {/* Spinning ring icon with HC */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: iconSize, height: iconSize }}
      >
        <style>{`
          @keyframes hc-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes hc-trace {
            0%   { stroke-dashoffset: ${circumference}; opacity: 1; }
            70%  { stroke-dashoffset: 0; opacity: 1; }
            85%  { stroke-dashoffset: 0; opacity: 0.3; }
            100% { stroke-dashoffset: ${circumference}; opacity: 1; }
          }
          @keyframes hc-pop {
            0%   { opacity: 0; transform: scale(0.3) translateY(6px); }
            60%  { transform: scale(1.15) translateY(-2px); }
            80%  { transform: scale(0.95) translateY(0); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes hc-shimmer {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.35) saturate(1.3); }
          }
          @keyframes hc-letter-pop {
            0%   { opacity: 0; transform: translateY(12px) scale(0.5); }
            65%  { transform: translateY(-3px) scale(1.12); }
            85%  { transform: translateY(1px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes hc-ring-glow {
            0%, 100% { filter: drop-shadow(0 0 ${isLg ? 8 : 5}px #a855f766); }
            33%  { filter: drop-shadow(0 0 ${isLg ? 12 : 7}px #06b6d466); }
            66%  { filter: drop-shadow(0 0 ${isLg ? 12 : 7}px #10b98166); }
          }
        `}</style>

        {/* SVG ring */}
        <svg
          width={iconSize}
          height={iconSize}
          viewBox={`0 0 ${iconSize} ${iconSize}`}
          className="absolute inset-0"
          style={{
            animation: animate ? "hc-ring-glow 3s ease-in-out infinite" : undefined,
          }}
        >
          <defs>
            <linearGradient id={RING_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#a855f7" />
              <stop offset="25%"  stopColor="#3b82f6" />
              <stop offset="50%"  stopColor="#06b6d4" />
              <stop offset="75%"  stopColor="#10b981" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          {/* Background circle track */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeW}
            className="text-slate-100 dark:text-slate-800"
          />
          {/* Animated tracing arc */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={`url(#${RING_GRADIENT_ID})`}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
            style={{
              transformOrigin: `${cx}px ${cx}px`,
              animation: animate
                ? "hc-spin 2.4s linear infinite"
                : undefined,
            }}
          />
        </svg>

        {/* HC letters in center */}
        <div
          className="relative z-10 flex items-end leading-none"
          style={{ gap: 1 }}
        >
          <span
            style={{
              fontSize: fontSize * 0.72,
              fontWeight: 900,
              color: "#a855f7",
              lineHeight: 1,
              animation: animate && visible
                ? "hc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both"
                : undefined,
            }}
          >H</span>
          <span
            style={{
              fontSize: fontSize * 0.72,
              fontWeight: 900,
              color: "#06b6d4",
              lineHeight: 1,
              animation: animate && visible
                ? "hc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.08s both"
                : undefined,
            }}
          >C</span>
        </div>
      </div>

      {/* Brand word */}
      {showText && (
        <div
          className={`font-black tracking-tight leading-none ${textSizeClass} select-none`}
          style={{ letterSpacing: "-0.01em" }}
        >
          {LETTERS.map((letter, i) => (
            <span
              key={i}
              style={{
                color: LETTER_COLORS[i],
                display: "inline-block",
                animation: animate && visible
                  ? `hc-letter-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 55}ms both`
                  : undefined,
              }}
            >
              {letter}
            </span>
          ))}
          <span
            className="text-slate-700 dark:text-slate-200"
            style={{
              fontWeight: 700,
              animation: animate && visible
                ? `hc-letter-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) ${LETTERS.length * 55 + 20}ms both`
                : undefined,
            }}
          >
            Circle
          </span>
        </div>
      )}
    </div>
  );
}

/** Compact icon-only ring — for favicons, tiny placements */
export function HealthCircleIcon({ size = 32 }: { size?: number }) {
  const r = size / 2 - 3;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="hci-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#a855f7" />
          <stop offset="50%"  stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e2e8f0" strokeWidth={2.5} />
      <circle
        cx={cx} cy={cx} r={r}
        fill="none" stroke="url(#hci-grad)"
        strokeWidth={2.5} strokeLinecap="round"
        strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
        style={{
          transformOrigin: `${cx}px ${cx}px`,
          animation: "hc-spin 2.4s linear infinite",
        }}
      />
      <text x={cx} y={cx + 4} textAnchor="middle" fontSize={size * 0.34} fontWeight={900} fill="url(#hci-grad)">HC</text>
    </svg>
  );
}
