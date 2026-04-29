import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

/**
 * Top-of-app loading bar that briefly appears whenever the URL changes.
 * Wouter is synchronous so navigation itself is instant, but the next page
 * usually has its own data-fetching delay before content paints. This bar
 * gives the user immediate visual feedback that something is happening.
 *
 * Behaviour:
 *  - On every location change, runs a quick fill-in animation (~300 ms),
 *    holds at ~85% briefly, then fades out (~250 ms).
 *  - Total visible time is ~700 ms — long enough to register, short enough
 *    not to feel laggy.
 *  - Pure CSS animation, no global state, no listeners that could leak.
 */
export default function RouteChangeProgress() {
  const [location] = useLocation();
  const [phase, setPhase] = useState<"idle" | "running" | "fading">("idle");
  const firstLocationRef = useRef<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Skip the very first render — we don't want a progress bar flashing on
    // the initial page load (the page itself owns the splash).
    if (firstLocationRef.current === null) {
      firstLocationRef.current = location;
      return;
    }
    if (firstLocationRef.current === location) return;
    firstLocationRef.current = location;

    // Reset any in-flight timers from a previous navigation.
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];

    setPhase("running");
    timersRef.current.push(
      setTimeout(() => setPhase("fading"), 500),
      setTimeout(() => setPhase("idle"), 850),
    );
  }, [location]);

  useEffect(() => {
    return () => {
      for (const t of timersRef.current) clearTimeout(t);
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[1100] pointer-events-none"
      aria-hidden="true"
      style={{ height: 3 }}
    >
      <style>{`
        @keyframes hc-rcp-fill {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(-15%); }
          100% { transform: translateX(-15%); }
        }
        @keyframes hc-rcp-fade {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hc-rcp-bar { animation: none !important; opacity: 0.6; }
        }
      `}</style>
      <div
        className="hc-rcp-bar absolute inset-y-0 left-0 right-0"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #a855f7 0%, #ec4899 18%, #3b82f6 38%, #06b6d4 58%, #10b981 78%, #f59e0b 100%)",
          boxShadow: "0 0 8px rgba(168, 85, 247, 0.45)",
          animation:
            phase === "running"
              ? "hc-rcp-fill 500ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards"
              : "hc-rcp-fade 350ms ease-out forwards",
          transformOrigin: "left",
        }}
      />
    </div>
  );
}
