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
const RING_GRADIENT_ID_2 = "hc-ring-grad-2";

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
  const innerStrokeW = isLg ? 2 : isSm ? 1.25 : 1.5;
  const textSizeClass = isLg ? "text-3xl" : isSm ? "text-base" : "text-xl";
  const gapClass = isLg ? "gap-3" : isSm ? "gap-2" : "gap-2.5";

  const cx = iconSize / 2;
  const r = iconSize / 2 - strokeW - 2;
  const r2 = r - strokeW - 2;
  const circumference = 2 * Math.PI * r;
  const circumference2 = 2 * Math.PI * r2;
  const dotR = isLg ? 3 : isSm ? 1.5 : 2;

  return (
    <div className={`group inline-flex items-center ${gapClass}`}>
      {/* Concentric animated rings + HC letters */}
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: iconSize, height: iconSize }}
      >
        <style>{`
          @keyframes hc-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes hc-spin-rev {
            0% { transform: rotate(360deg); }
            100% { transform: rotate(0deg); }
          }
          @keyframes hc-breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
          @keyframes hc-pop {
            0%   { opacity: 0; transform: scale(0.3) translateY(6px); }
            60%  { transform: scale(1.15) translateY(-2px); }
            80%  { transform: scale(0.95) translateY(0); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes hc-letter-pop {
            0%   { opacity: 0; transform: translateY(12px) scale(0.5); }
            65%  { transform: translateY(-3px) scale(1.12); }
            85%  { transform: translateY(1px) scale(0.97); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes hc-ring-glow {
            0%, 100% { filter: drop-shadow(0 0 ${isLg ? 6 : 4}px #a855f755); }
            33%      { filter: drop-shadow(0 0 ${isLg ? 10 : 6}px #06b6d455); }
            66%      { filter: drop-shadow(0 0 ${isLg ? 10 : 6}px #10b98155); }
          }
          @keyframes hc-pulse-ring {
            0%   { transform: scale(0.85); opacity: 0.7; }
            80%  { transform: scale(1.25); opacity: 0; }
            100% { transform: scale(1.25); opacity: 0; }
          }
          @keyframes hc-letter-breathe {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50%      { transform: scale(1.04); filter: brightness(1.15); }
          }
          .hc-spin-fast { animation-duration: 1.6s !important; }
          .group:hover .hc-hover-fast { animation-duration: 1.4s !important; }
          @media (prefers-reduced-motion: reduce) {
            .hc-anim { animation: none !important; }
          }
        `}</style>

        {/* Outer pulse ring (Windows Hello style ripple) */}
        {animate && (
          <span
            className="hc-anim absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(168,85,247,0.25) 0%, rgba(6,182,212,0.18) 50%, transparent 70%)",
              animation: "hc-pulse-ring 2.8s ease-out infinite",
            }}
          />
        )}

        {/* Main SVG with two concentric rings + orbital dots */}
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
            <linearGradient id={RING_GRADIENT_ID_2} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#ef4444" />
              <stop offset="50%"  stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Outer track */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeW}
            className="text-slate-100 dark:text-slate-800"
          />
          {/* Outer animated arc */}
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={`url(#${RING_GRADIENT_ID})`}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
            className="hc-anim hc-hover-fast"
            style={{
              transformOrigin: `${cx}px ${cx}px`,
              animation: animate ? "hc-spin 2.4s linear infinite" : undefined,
            }}
          />
          {/* Inner counter-rotating arc */}
          <circle
            cx={cx} cy={cx} r={r2}
            fill="none"
            stroke={`url(#${RING_GRADIENT_ID_2})`}
            strokeWidth={innerStrokeW}
            strokeLinecap="round"
            strokeDasharray={`${circumference2 * 0.4} ${circumference2 * 0.6}`}
            className="hc-anim hc-hover-fast"
            style={{
              transformOrigin: `${cx}px ${cx}px`,
              animation: animate ? "hc-spin-rev 3.2s linear infinite" : undefined,
              opacity: 0.85,
            }}
          />

          {/* Orbital dot traveling along the outer ring */}
          {animate && (
            <g
              className="hc-anim"
              style={{
                transformOrigin: `${cx}px ${cx}px`,
                animation: "hc-spin 2.4s linear infinite",
              }}
            >
              <circle cx={cx} cy={cx - r} r={dotR} fill="#ffffff" />
              <circle cx={cx} cy={cx - r} r={dotR * 0.6} fill="#a855f7" />
            </g>
          )}
          {/* Second orbital dot, opposite side, slower */}
          {animate && !isSm && (
            <g
              className="hc-anim"
              style={{
                transformOrigin: `${cx}px ${cx}px`,
                animation: "hc-spin-rev 3.2s linear infinite",
              }}
            >
              <circle cx={cx} cy={cx + r2} r={dotR * 0.85} fill="#ffffff" />
              <circle cx={cx} cy={cx + r2} r={dotR * 0.5} fill="#10b981" />
            </g>
          )}
        </svg>

        {/* HC letters in center with subtle breathing */}
        <div
          className="relative z-10 flex items-end leading-none"
          style={{
            gap: 1,
            animation: animate ? "hc-breathe 3s ease-in-out infinite" : undefined,
          }}
        >
          <span
            style={{
              fontSize: fontSize * 0.72,
              fontWeight: 900,
              color: "#a855f7",
              lineHeight: 1,
              animation: animate && visible
                ? "hc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, hc-letter-breathe 3s ease-in-out 0.5s infinite"
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
                ? "hc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.08s both, hc-letter-breathe 3s ease-in-out 0.7s infinite"
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
