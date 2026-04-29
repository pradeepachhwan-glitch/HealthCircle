import { motion, useReducedMotion, type Variants } from "framer-motion";
import { type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
  once?: boolean;
}

/**
 * Wrap any block to fade + slide it in once it enters the viewport.
 * Honors prefers-reduced-motion. Animations only fire one time per element.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
  once = true,
}: RevealProps) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : y },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
        delay,
      },
    },
  };

  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.2, margin: "0px 0px -10% 0px" }}
      variants={variants}
    >
      {children}
    </Comp>
  );
}

/** Stagger child Reveal blocks. */
export function RevealStagger({
  children,
  className,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -10% 0px" }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: reduce ? 0 : stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
