const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Props {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  animate?: boolean;
}

export default function HealthCircleLogo(props: Props) {
  const { size = "md", showText = true } = props;

  const isLg = size === "lg";
  const isSm = size === "sm";

  const iconSize = isLg ? 80 : isSm ? 40 : 56;
  const textSizeClass = isLg ? "text-3xl" : isSm ? "text-lg" : "text-xl";
  const gapClass = isLg ? "gap-3" : isSm ? "gap-2" : "gap-2.5";

  return (
    <div className={`inline-flex items-center ${gapClass}`}>
      <img
        src={`${basePath}/icon-192.png`}
        alt="HealthCircle"
        width={iconSize}
        height={iconSize}
        className="shrink-0 select-none"
        style={{ width: iconSize, height: iconSize }}
        draggable={false}
      />
      {showText && (
        <span
          className={`font-bold tracking-tight text-slate-900 dark:text-white leading-none ${textSizeClass} select-none`}
          style={{ letterSpacing: "-0.01em" }}
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
