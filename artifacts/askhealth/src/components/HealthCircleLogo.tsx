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

  const containerSize = isLg ? 112 : isSm ? 64 : 84;
  const imgSize = isLg ? 86 : isSm ? 50 : 66;
  const textSizeClass = isLg ? "text-4xl" : isSm ? "text-xl" : "text-3xl";
  const sideGap = isLg ? 16 : isSm ? 12 : 14;
  const barHeight = isLg ? 4 : isSm ? 3 : 3.5;

  const cx = containerSize / 2;
  const strokeW = isLg ? 4 : isSm ? 2.75 : 3.25;
  const r = containerSize / 2 - strokeW / 2 - 1;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="inline-flex flex-col items-stretch" style={{ rowGap: 6 }}>
      <style>{`
        @keyframes hc-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hc-bar-slide {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(210%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hc-anim { animation: none !important; }
        }
      `}</style>

      {/* Logo + text row */}
      <div
        className="inline-flex items-center"
        style={{ columnGap: sideGap }}
      >
        {/* Logo with revolving ring */}
        <div
          className="relative shrink-0"
          style={{ width: containerSize, height: containerSize }}
        >
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
              filter: "drop-shadow(0 0 5px rgba(168, 85, 247, 0.35))",
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
              stroke="url(#hc-ring-grad)"
              strokeWidth={strokeW}
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.72} ${circumference * 0.28}`}
            />
          </svg>

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

      {/* Vibrant rainbow bar sliding left-to-right under the whole logo */}
      <div
        className="relative overflow-hidden rounded-full w-full"
        style={{
          height: barHeight,
          backgroundColor: "rgba(148, 163, 184, 0.18)",
        }}
        aria-hidden="true"
      >
        <div
          className="hc-anim absolute inset-y-0 left-0 rounded-full"
          style={{
            width: "45%",
            backgroundImage: VIBRANT_GRADIENT,
            animation: animate
              ? "hc-bar-slide 2.4s ease-in-out infinite"
              : undefined,
          }}
        />
      </div>
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
