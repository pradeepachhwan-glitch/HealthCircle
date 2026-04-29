const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  animate?: boolean;
}

const VIBRANT_GRADIENT =
  "linear-gradient(90deg, #a855f7 0%, #ec4899 18%, #3b82f6 38%, #06b6d4 58%, #10b981 78%, #f59e0b 100%)";

export default function HealthCircleLogo(props: Props) {
  const { size = "md", showText = true, animate = true } = props;

  const isLg = size === "lg";
  const isSm = size === "sm";

  const containerSize = isLg ? 96 : isSm ? 52 : 70;
  const imgSize = isLg ? 74 : isSm ? 40 : 54;
  const textSizeClass = isLg ? "text-3xl" : isSm ? "text-lg" : "text-2xl";
  const sideGap = isLg ? 14 : isSm ? 10 : 12;

  const cx = containerSize / 2;
  const strokeW = isLg ? 3.5 : isSm ? 2.5 : 3;
  const r = containerSize / 2 - strokeW / 2 - 1;
  const circumference = 2 * Math.PI * r;

  return (
    <div
      className="inline-flex items-center"
      style={{ columnGap: sideGap }}
    >
      <style>{`
        @keyframes hc-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hc-bar-slide {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(110%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hc-anim { animation: none !important; }
        }
      `}</style>

      {/* Logo with revolving ring (and underline bar when no text) */}
      <div className="inline-flex flex-col items-center" style={{ rowGap: 6 }}>
        <div
          className="relative shrink-0"
          style={{ width: containerSize, height: containerSize }}
        >
          {/* Revolving vibrant ring */}
          <svg
            width={containerSize}
            height={containerSize}
            viewBox={`0 0 ${containerSize} ${containerSize}`}
            className="hc-anim absolute inset-0"
            style={{
              transformOrigin: `${cx}px ${cx}px`,
              animation: animate
                ? "hc-ring-spin 3.5s linear infinite"
                : undefined,
              filter: "drop-shadow(0 0 4px rgba(168, 85, 247, 0.35))",
            }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="hc-ring-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="20%" stopColor="#ec4899" />
                <stop offset="40%" stopColor="#3b82f6" />
                <stop offset="60%" stopColor="#06b6d4" />
                <stop offset="80%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            {/* Faint background track */}
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke="rgba(148, 163, 184, 0.18)"
              strokeWidth={strokeW}
            />
            {/* Vibrant rotating arc */}
            <circle
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke="url(#hc-ring-grad)"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
            />
          </svg>

          {/* Logo image centered inside the ring */}
          <img
            src={`${basePath}/icon-192.png`}
            alt="HealthCircle"
            width={imgSize}
            height={imgSize}
            draggable={false}
            className="absolute select-none"
            style={{
              top: (containerSize - imgSize) / 2,
              left: (containerSize - imgSize) / 2,
              width: imgSize,
              height: imgSize,
            }}
          />
        </div>

        {/* Vibrant moving bar underneath when there's no text label */}
        {!showText && (
          <div
            className="relative overflow-hidden rounded-full"
            style={{
              width: containerSize,
              height: 3,
              backgroundColor: "rgba(148, 163, 184, 0.18)",
            }}
          >
            <div
              className="hc-anim absolute inset-y-0 left-0"
              style={{
                width: "60%",
                backgroundImage: VIBRANT_GRADIENT,
                borderRadius: 999,
                animation: animate
                  ? "hc-bar-slide 1.8s ease-in-out infinite"
                  : undefined,
              }}
            />
          </div>
        )}
      </div>

      {/* Vibrant gradient wordmark beside the logo */}
      {showText && (
        <span
          className={`font-extrabold tracking-tight leading-none select-none ${textSizeClass}`}
          style={{
            backgroundImage: VIBRANT_GRADIENT,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            letterSpacing: "-0.015em",
          }}
        >
          HealthCircle
        </span>
      )}
    </div>
  );
}

export function HealthCircleIcon({ size = 32 }: { size?: number }) {
  return (
    <img
      src={`${basePath}/icon-192.png`}
      alt="HealthCircle"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
