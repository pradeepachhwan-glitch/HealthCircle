import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight, Mic } from "lucide-react";
import { isVoiceInputSupported } from "@/lib/voice";

/**
 * Desktop-only floating Yukti shortcut.
 * Appears after the user scrolls past ~600px (i.e. past the hero).
 * Hidden on mobile because the bottom-nav already exposes Yukti.
 *
 * Two interactive elements (siblings — never nested controls):
 *   1. "Ask Yukti" anchor → scrolls to the in-page demo widget.
 *   2. Mic circle (only when SpeechRecognition is supported) → dispatches a
 *      `yukti-voice-start` event the demo listens for, kicking off voice
 *      dictation immediately. The user's click on this button IS the user
 *      gesture the browser requires for mic access, so we synchronously
 *      dispatch the event here.
 *
 * Plus a sibling dismiss × button.
 */
export function FloatingYuktiPill() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Only render the mic button if the browser supports SpeechRecognition.
  const [voiceSupported, setVoiceSupported] = useState(false);

  useEffect(() => {
    setVoiceSupported(isVoiceInputSupported());
  }, []);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (dismissed) return null;

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
          className="fixed bottom-6 right-6 z-40 hidden md:flex items-end gap-2"
          {...entry}
        >
          {/* Mic — instant voice from anywhere on the page */}
          {voiceSupported && (
            <motion.button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("yukti-voice-start"));
              }}
              data-testid="floating-yukti-mic"
              aria-label="Ask Yukti by voice — opens the demo and starts listening"
              title="Speak to Yukti"
              className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-[0_18px_40px_-12px_rgba(244,63,94,0.6)] hover:shadow-[0_24px_50px_-12px_rgba(244,63,94,0.7)] transition-shadow"
              whileHover={reduce ? undefined : { scale: 1.08 }}
              whileTap={reduce ? undefined : { scale: 0.94 }}
            >
              {/* Pulsing halo to invite tapping */}
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-rose-400"
                  animate={{ scale: [1, 1.35, 1.55], opacity: [0.45, 0.1, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              <Mic className="relative h-5 w-5" strokeWidth={2.25} />
            </motion.button>
          )}

          {/* Ask Yukti pill — scrolls to demo */}
          <div className="relative">
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
            {/* Dismiss — sibling of the anchor */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss Ask Yukti shortcut"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 text-[11px] leading-none flex items-center justify-center shadow-sm"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
