const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  /** Show or hide the overlay. */
  show?: boolean;
  /** Optional message under the spinner. */
  label?: string;
  /** "fixed" covers the entire viewport with a translucent scrim (default).
   *  "inline" renders the spinner only, sized to its parent — useful inside
   *  cards / panels where you don't want a full-screen scrim. */
  variant?: "fixed" | "inline";
  /** Diameter of the ring + logo in px. Defaults to 96 for fixed, 56 for inline. */
  size?: number;
  /** Animation period for the ring spin in seconds. Smaller = faster.
   *  Default 1.4s — about 2.5× faster than the home-screen logo (3.5s) so it
   *  reads as "actively loading" rather than ambient brand motion. */
  spinSeconds?: number;
}

/**
 * Brand-consistent loading indicator. Mirrors the home-screen logo's
 * revolving rainbow ring around the HealthCircle icon, but spins faster to
 * communicate active progress. Use as either a full-screen scrim
 * (`variant="fixed"`) for global waits / fallback errors, or as an inline
 * widget (`variant="inline"`) inside a panel.
 */
export default function LoadingOverlay(props: Props) {
  const {
    show = true,
    label,
    variant = "fixed",
    spinSeconds = 1.4,
  } = props;

  const isFixed = variant === "fixed";
  const size = props.size ?? (isFixed ? 96 : 56);

  // Ring geometry — same proportions as HealthCircleLogo so the visual
  // matches the brand mark.
  const cx = size / 2;
  const strokeW = size >= 80 ? 4 : size >= 56 ? 3.25 : 2.5;
  const r = size / 2 - strokeW / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const imgSize = Math.round(size * 0.72);

  if (!show) return null;

  const ring = (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="hc-loader-anim absolute inset-0"
        style={{
          transformOrigin: `${cx}px ${cx}px`,
          animation: `hc-loader-spin ${spinSeconds}s linear infinite`,
          filter: "drop-shadow(0 0 6px rgba(168, 85, 247, 0.45))",
        }}
      >
        <defs>
          <linearGradient id="hc-loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="20%" stopColor="#ec4899" />
            <stop offset="40%" stopColor="#3b82f6" />
            <stop offset="60%" stopColor="#06b6d4" />
            <stop offset="80%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth={strokeW}
        />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="url(#hc-loader-grad)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
        />
      </svg>
      <img
        src={`${basePath}/icon-192.png`}
        alt=""
        width={imgSize}
        height={imgSize}
        draggable={false}
        className="absolute select-none hc-loader-pulse"
        style={{
          top: (size - imgSize) / 2,
          left: (size - imgSize) / 2,
          width: imgSize,
          height: imgSize,
          borderRadius: "50%",
          backgroundColor: "white",
        }}
      />
    </div>
  );

  const styleTag = (
    <style>{`
      @keyframes hc-loader-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes hc-loader-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.85; transform: scale(0.96); }
      }
      .hc-loader-pulse {
        animation: hc-loader-pulse 1.6s ease-in-out infinite;
      }
      @keyframes hc-loader-fade {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .hc-loader-scrim {
        animation: hc-loader-fade 180ms ease-out both;
      }
      @media (prefers-reduced-motion: reduce) {
        .hc-loader-anim, .hc-loader-pulse, .hc-loader-scrim { animation: none !important; }
      }
    `}</style>
  );

  if (variant === "inline") {
    return (
      <div className="inline-flex flex-col items-center justify-center gap-2">
        {styleTag}
        {ring}
        {label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="hc-loader-scrim fixed inset-0 z-[1000] flex flex-col items-center justify-center pointer-events-auto"
      style={{
        backgroundColor: "rgba(15, 23, 42, 0.35)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }}
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
    >
      {styleTag}
      {ring}
      {label && (
        <span className="mt-4 text-sm font-medium text-white/90 drop-shadow">
          {label}
        </span>
      )}
    </div>
  );
}
