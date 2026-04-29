import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Desktop-only floating "Ask Yukti" pill.
 * Appears after the user scrolls past ~600px (i.e. past the hero).
 * Hidden on mobile because the bottom-nav already exposes Yukti.
 *
 * Renders as a single anchor element to keep semantics valid (no nested
 * interactive controls). The dismiss button is a sibling, not a child.
 */
export function FloatingYuktiPill() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

  // When reduced-motion is on, skip entry/exit animations and hover scale.
  const entry = reduce
    ? { initial: false as const, animate: undefined, exit: undefined, transition: undefined }
    : {
        initial: { opacity: 0, y: 24, scale: 0.92 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 24, scale: 0.92 },
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-6 right-6 z-40 hidden md:block"
          {...entry}
        >
          {/* Single interactive element: an anchor styled as a pill button */}
          <motion.a
            href="/#try-yukti"
            data-testid="floating-yukti-pill"
            aria-label="Ask Yukti — open the free demo"
            className="group relative flex items-center gap-2.5 pl-4 pr-5 py-3 rounded-full bg-slate-900 text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.45)] hover:shadow-[0_24px_50px_-12px_rgba(15,23,42,0.55)] transition-shadow"
            whileHover={reduce ? undefined : { scale: 1.04 }}
            whileTap={reduce ? undefined : { scale: 0.97 }}
          >
            {/* Pulsing halo */}
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500/40 via-cyan-500/40 to-emerald-500/40 -z-10"
                animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
              />
            )}
            <motion.span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 via-cyan-500 to-emerald-500"
              animate={reduce ? undefined : { rotate: [0, 360] }}
              transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </motion.span>
            <span className="text-sm font-semibold whitespace-nowrap">Ask Yukti</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </motion.a>
          {/* Dismiss button — sibling, NOT nested inside the anchor */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss Ask Yukti shortcut"
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 text-[11px] leading-none flex items-center justify-center shadow-sm"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
