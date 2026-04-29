import { useRef, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, type MotionValue } from "framer-motion";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum tilt angle in degrees */
  maxTilt?: number;
  /** Show a soft cursor-following highlight */
  glare?: boolean;
}

/**
 * Wraps children with a subtle 3D mouse-tilt effect.
 * - Uses motion springs so the transform feels weighty, not jittery.
 * - Auto-disables on touch / reduced-motion.
 * - Adds an optional radial highlight that follows the cursor.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 6,
  glare = true,
}: TiltCardProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  // All hooks declared at the top level so the call order is stable
  // regardless of `glare` or `reduce` props.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  const rotateX = useTransform(sy, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-maxTilt, maxTilt]);

  // Derive the cursor-position-driven radial highlight at the top level
  // (not inside conditional JSX) so hook order never changes.
  const glareBg = useTransform<number, string>(
    [sx, sy] as MotionValue<number>[],
    ([gx, gy]) => {
      const px = (Number(gx) + 0.5) * 100;
      const py = (Number(gy) + 0.5) * 100;
      return `radial-gradient(280px circle at ${px}% ${py}%, rgba(99,102,241,0.18), transparent 60%)`;
    }
  );

  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reduce) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    x.set(px);
    y.set(py);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 900,
        transformStyle: "preserve-3d",
      }}
      className={`${className ?? ""} relative`}
    >
      {children}
      {glare && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background: glareBg }}
        />
      )}
    </motion.div>
  );
}
