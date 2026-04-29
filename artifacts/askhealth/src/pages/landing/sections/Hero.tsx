import { Link } from "wouter";
import { ArrowRight, Heart, Sparkles, Activity, Leaf } from "lucide-react";
import { LandingYuktiDemo } from "@/components/LandingYuktiDemo";

/**
 * Single icon chip that sits at one cardinal point on the hero's orbit ring.
 * The outer div positions it on the rim using translate; the inner div
 * counter-rotates so the chip stays upright as the parent ring rotates.
 *
 * Tailwind transform classes (`-translate-x-1/2`, etc.) live on the OUTER
 * wrapper while the rotation animation runs on the INNER div — putting both
 * on the same element would cause the animation's `transform: rotate(...)`
 * to overwrite the translate and the chip would snap to centre.
 */
function OrbitIcon({
  position,
  ringTone,
  shadowColor,
  children,
}: {
  position: "top" | "right" | "bottom" | "left";
  /** Literal Tailwind ring class — must appear verbatim in source so JIT picks it up. */
  ringTone: "ring-rose-100" | "ring-violet-100" | "ring-emerald-100" | "ring-amber-100";
  /** Raw rgba colour for the soft drop shadow (inline-styled — Tailwind JIT
   *  cannot detect interpolated arbitrary-value class names). */
  shadowColor: string;
  children: React.ReactNode;
}) {
  const positionClasses = {
    top:    "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    right:  "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    bottom: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    left:   "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  }[position];
  return (
    <div className={`absolute ${positionClasses}`}>
      <div
        className={`ring-orbit-counter h-12 w-12 lg:h-14 lg:w-14 rounded-2xl bg-white/85 backdrop-blur ring-1 ${ringTone} flex items-center justify-center`}
        style={{ boxShadow: `0 8px 24px -10px ${shadowColor}` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Set the URL hash. The global `useHashScroll` hook in Landing.tsx listens
 * for `hashchange` events and handles the smooth-scroll + ring-flash, so
 * we only need to nudge the hash here. Setting it to "" first ensures
 * `hashchange` fires even when the user clicks the same CTA twice.
 */
function goToDemo(e: React.MouseEvent) {
  if (typeof window === "undefined") return;
  e.preventDefault();
  if (window.location.hash === "#try-yukti") {
    window.location.hash = "";
  }
  window.location.hash = "try-yukti";
}

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Decorative background — warm coral blob + cool indigo blob + dotted ring.
          Warm + cool together = alive but balanced (not Aditya-Birla-red, not corporate). */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Warm coral/peach blob — left side */}
        <div className="absolute -top-24 -left-32 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-rose-200/45 via-orange-100/30 to-transparent blur-3xl" />
        {/* Cool indigo blob — right side (kept from before) */}
        <div className="absolute -top-32 -right-40 h-[640px] w-[640px] rounded-full bg-gradient-to-br from-indigo-100/60 via-violet-50/40 to-transparent blur-3xl" />
        {/* Soft amber wash at the bottom — sunset feeling */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[900px] rounded-full bg-gradient-to-t from-amber-100/30 via-rose-50/20 to-transparent blur-3xl" />
        {/* Big centered ring spanning the hero — desktop only. Four health
            icons orbit slowly along its rim (Heart=care, Sparkles=Yukti AI =
            modern intelligence, Activity=EKG/vitality, Leaf=Ayurveda /
            timeless wisdom). The rim sits ~95% of container width so it
            kisses the side blobs without overflowing the visible hero. */}
        <div
          aria-hidden
          className="hidden md:flex absolute inset-0 items-center justify-center"
        >
          <div
            className="relative"
            style={{
              width: "min(96%, 1080px)",
              aspectRatio: "1 / 1",
              maxHeight: "min(96%, 720px)",
            }}
          >
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full text-indigo-200/70"
              viewBox="0 0 800 800"
              fill="none"
            >
              <circle cx="400" cy="400" r="395" stroke="currentColor" strokeWidth="1" />
              <circle cx="400" cy="400" r="350" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 6" />
            </svg>
            {/* The orbiting wrapper. Rotates clockwise every 90s; reduced-motion users see icons fixed at their cardinal positions. */}
            <div className="absolute inset-0 ring-orbit">
              <OrbitIcon position="top"    ringTone="ring-rose-100"    shadowColor="rgba(244,63,94,0.4)">
                <Heart className="h-5 w-5 lg:h-6 lg:w-6 text-rose-500" strokeWidth={1.75} fill="currentColor" fillOpacity={0.18} />
              </OrbitIcon>
              <OrbitIcon position="right"  ringTone="ring-violet-100"  shadowColor="rgba(139,92,246,0.4)">
                <Sparkles className="h-5 w-5 lg:h-6 lg:w-6 text-violet-500" strokeWidth={1.75} />
              </OrbitIcon>
              <OrbitIcon position="bottom" ringTone="ring-emerald-100" shadowColor="rgba(16,185,129,0.4)">
                <Activity className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-500" strokeWidth={1.75} />
              </OrbitIcon>
              <OrbitIcon position="left"   ringTone="ring-amber-100"   shadowColor="rgba(217,119,6,0.4)">
                <Leaf className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" strokeWidth={1.75} fill="currentColor" fillOpacity={0.15} />
              </OrbitIcon>
            </div>
          </div>
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
        {/* Live "We're online" pill — adds subtle movement; honest (always-on AI) */}
        <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-white/70 backdrop-blur ring-1 ring-emerald-200/70 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Yukti is online · Ask anytime
          </span>
        </span>

        <h1 className="font-serif text-[42px] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[72px] lg:leading-[1.02] font-medium text-slate-900 tracking-[-0.02em] mb-6">
          Healthcare clarity,
          <br className="hidden sm:block" />{" "}
          <span className="italic text-sunset-gradient">the moment</span> you need it.
        </h1>

        <p className="text-lg md:text-xl text-slate-700 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
          Yukti — India's AI Health companion, built for the World;
          powered by{" "}
          <span className="font-semibold text-violet-700">modern intelligence</span>,
          and anchored in the{" "}
          <span className="font-semibold text-amber-700">timeless wisdom</span>{" "}
          of traditional wellness.
        </p>

        <div className="flex items-center justify-center gap-5 flex-wrap mb-5">
          <a
            href="#try-yukti"
            onClick={goToDemo}
            className="group relative inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 text-white rounded-full font-semibold text-base hover:bg-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.04),0_10px_28px_-8px_rgba(99,102,241,0.55),0_4px_12px_-4px_rgba(244,63,94,0.25)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_18px_36px_-8px_rgba(99,102,241,0.7),0_8px_16px_-4px_rgba(244,63,94,0.35)] hover:-translate-y-0.5 transition-all duration-200"
            data-testid="hero-primary-cta"
          >
            <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-rose-400/0 via-violet-400/30 to-indigo-400/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300" />
            Try Yukti free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
          >
            or create an account
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          No signup required · 1 free question · English & हिंदी
        </p>

        {/* Live product proof — the Yukti demo widget. This IS "Try Yukti free". */}
        <div id="try-yukti" className="mt-14 md:mt-16 scroll-mt-24 transition-shadow duration-500 rounded-3xl">
          <LandingYuktiDemo />
        </div>
      </div>
    </section>
  );
}
