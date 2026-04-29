import { Link } from "wouter";
import { ArrowRight, Heart, Sparkles, Activity, Leaf } from "lucide-react";
import { LandingYuktiDemo } from "@/components/LandingYuktiDemo";

/**
 * One "planet" — an icon chip that orbits the hero ring at its own radius,
 * its own speed, and starting from its own angle. Inspired by a solar system:
 *
 *   - Outer wrapper (`ring-orbit`) is a square pinned to a sub-region of the
 *     ring container via `inset` (the smaller the inset, the larger the
 *     orbital radius). It rotates clockwise with `durationS` period, and the
 *     `delayS` shift starts it at any phase of the orbit.
 *   - Position div places the icon at one cardinal point of the rotating
 *     square, so the icon's actual orbital radius = (containerSize - 2*inset)/2.
 *   - Inner div counter-rotates with the SAME duration + SAME delay so the
 *     icon glyph stays upright while travelling around its orbit.
 *
 * Putting translate + rotate on the same element would let the animation's
 * `transform: rotate(...)` overwrite the translate and snap the chip to
 * centre, which is why we keep three nested divs.
 */
function PlanetIcon({
  startAt,
  ringTone,
  shadowColor,
  durationS,
  delayS,
  inset = "0",
  children,
}: {
  /** Where the icon STARTS in its orbit (delay also offsets this). */
  startAt: "top" | "right" | "bottom" | "left";
  /** Literal Tailwind ring class — must appear verbatim in source so JIT picks it up. */
  ringTone: "ring-rose-100" | "ring-violet-100" | "ring-emerald-100" | "ring-amber-100";
  /** Raw rgba colour for the soft drop shadow (inline-styled — Tailwind JIT
   *  cannot detect interpolated arbitrary-value class names). */
  shadowColor: string;
  /** Orbital period in seconds. */
  durationS: number;
  /** Negative seconds → start partway through the orbit. */
  delayS: number;
  /** Tailwind inset value (e.g. "0", "6%", "12%"). Smaller = bigger orbit. */
  inset?: string;
  children: React.ReactNode;
}) {
  const positionClasses = {
    top:    "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    right:  "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    bottom: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    left:   "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  }[startAt];
  const animStyle = {
    animationDuration: `${durationS}s`,
    animationDelay: `${delayS}s`,
  };
  return (
    <div className="absolute ring-orbit" style={{ inset, ...animStyle }}>
      <div className={`absolute ${positionClasses}`}>
        <div
          className={`ring-orbit-counter h-12 w-12 lg:h-14 lg:w-14 rounded-2xl bg-white/90 backdrop-blur ring-1 ${ringTone} flex items-center justify-center`}
          style={{ boxShadow: `0 10px 28px -8px ${shadowColor}`, ...animStyle }}
        >
          {children}
        </div>
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
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50/80 via-white to-amber-50/60 [isolation:isolate]">
      {/* Decorative background — warm coral blob + cool indigo blob + dotted
          rings + planetary icons. Warm + cool together = alive but balanced.
          Tints are pushed deeper than before so the hero reads as a coloured
          surface (matches the soft pillar-card washes in the Three Pillars
          section below).

          NOTE: We deliberately do NOT put a negative z-index here. The section
          now has a `bg-gradient` background, and `relative; overflow-hidden`
          alone does not establish a stacking context — so a `-z-10` child
          would render BEHIND the section's gradient and disappear. Natural
          DOM order (decoration first, content second, both `z-auto`) already
          stacks content above decoration above the gradient. */}
      <div className="pointer-events-none absolute inset-0">
        {/* Warm coral/peach blob — left side */}
        <div className="absolute -top-24 -left-32 h-[560px] w-[560px] rounded-full bg-gradient-to-br from-rose-200/65 via-orange-100/45 to-transparent blur-3xl" />
        {/* Cool indigo blob — right side */}
        <div className="absolute -top-32 -right-40 h-[680px] w-[680px] rounded-full bg-gradient-to-br from-indigo-200/55 via-violet-100/40 to-transparent blur-3xl" />
        {/* Soft amber wash at the bottom — sunset feeling */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[340px] w-[980px] rounded-full bg-gradient-to-t from-amber-200/45 via-rose-100/30 to-transparent blur-3xl" />
        {/* Centred soft mint blob — picks up the emerald orbit + tagline harmony */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[460px] w-[460px] rounded-full bg-gradient-to-br from-emerald-100/35 via-cyan-50/30 to-transparent blur-3xl" />

        {/* Big planetary ring system spanning the hero — desktop only.
            Four health icons orbit at *different* radii, *different* speeds,
            and starting from *different* angles, so the system reads as a
            living solar system rather than a synchronised quartet. The icons:
              • Heart (rose) = care (outer orbit, slowest)
              • Sparkles (violet) = Yukti AI / modern intelligence (mid orbit, faster)
              • Activity (emerald) = EKG / vitality (inner orbit, fastest)
              • Leaf (amber) = Ayurveda / timeless wisdom (outer orbit, slow)
            A tiny amber "sun" sits at the centre of all the orbits. */}
        <div
          aria-hidden
          className="hidden lg:flex absolute inset-0 items-center justify-center"
        >
          <div
            className="relative"
            style={{
              // True square — width is the MIN of container%, viewport-height%,
              // and an absolute cap. This guarantees aspect-ratio:1/1 isn't
              // overridden by maxHeight conflict (which would silently turn the
              // box into a 1080×720 rectangle and put PlanetIcons on an
              // ellipse that no longer hugs the SVG circle).
              width: "min(720px, 70vh, 92vw)",
              aspectRatio: "1 / 1",
            }}
          >
            <svg
              aria-hidden
              className="absolute inset-0 h-full w-full text-indigo-300/80"
              viewBox="0 0 800 800"
              fill="none"
            >
              <defs>
                <radialGradient id="hero-sun" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="rgba(251,191,36,0.55)" />
                  <stop offset="60%"  stopColor="rgba(251,146,60,0.18)" />
                  <stop offset="100%" stopColor="rgba(251,146,60,0)" />
                </radialGradient>
              </defs>
              {/* Outer rim — bold so the ring is unmistakable */}
              <circle cx="400" cy="400" r="395" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
              {/* Mid orbital path — dashed */}
              <circle cx="400" cy="400" r="340" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 9" opacity="0.7" />
              {/* Inner orbital path — fainter dashed */}
              <circle cx="400" cy="400" r="280" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 8" opacity="0.55" />
              {/* Centre "sun" glow — anchors the planetary system */}
              <circle cx="400" cy="400" r="42" fill="url(#hero-sun)" />
              <circle cx="400" cy="400" r="5"  fill="rgba(245,158,11,0.85)" />
            </svg>
            {/* Each icon now has its OWN orbit, speed, and start angle —
                no shared parent rotation. Reduced-motion users see them
                fixed wherever the delay+inset places them. */}
            <PlanetIcon
              startAt="top"    ringTone="ring-rose-100"    shadowColor="rgba(244,63,94,0.45)"
              inset="0"        durationS={85} delayS={0}
            >
              <Heart className="h-5 w-5 lg:h-6 lg:w-6 text-rose-500" strokeWidth={1.75} fill="currentColor" fillOpacity={0.2} />
            </PlanetIcon>
            <PlanetIcon
              startAt="right"  ringTone="ring-violet-100"  shadowColor="rgba(139,92,246,0.45)"
              inset="6%"       durationS={55} delayS={-14}
            >
              <Sparkles className="h-5 w-5 lg:h-6 lg:w-6 text-violet-500" strokeWidth={1.75} />
            </PlanetIcon>
            <PlanetIcon
              startAt="bottom" ringTone="ring-emerald-100" shadowColor="rgba(16,185,129,0.45)"
              inset="14%"      durationS={42} delayS={-28}
            >
              <Activity className="h-5 w-5 lg:h-6 lg:w-6 text-emerald-500" strokeWidth={1.75} />
            </PlanetIcon>
            <PlanetIcon
              startAt="left"   ringTone="ring-amber-100"   shadowColor="rgba(217,119,6,0.45)"
              inset="2%"       durationS={100} delayS={-40}
            >
              <Leaf className="h-5 w-5 lg:h-6 lg:w-6 text-amber-600" strokeWidth={1.75} fill="currentColor" fillOpacity={0.18} />
            </PlanetIcon>
          </div>
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-12 sm:pt-16 sm:pb-16 md:pt-20 md:pb-20 lg:pt-28 lg:pb-24 text-center">
        {/* Live "We're online" pill — adds subtle movement; honest (always-on AI) */}
        <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-5 rounded-full bg-white/70 backdrop-blur ring-1 ring-emerald-200/70 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
            Yukti is online · Ask anytime
          </span>
        </span>

        {/* H1 — `text-balance` (CSS native) keeps line lengths visually even
            so we don't need a brittle hand-placed <br>. Mobile size dropped
            from 42px → 34px so it never wraps to four lines on a 360px
            Android. Sunset gradient now has a no-wrap hint to keep the two
            italicised words together where layout allows. */}
        <h1
          className="font-serif text-[34px] leading-[1.08] sm:text-[44px] sm:leading-[1.05] md:text-5xl md:leading-[1.04] lg:text-[64px] lg:leading-[1.03] xl:text-[72px] xl:leading-[1.02] font-medium text-slate-900 tracking-[-0.02em] mb-5 sm:mb-6 px-1"
          style={{ textWrap: "balance" }}
        >
          Healthcare clarity,{" "}
          <span className="italic text-sunset-gradient whitespace-nowrap">the moment</span>{" "}
          you need it.
        </h1>

        <p
          className="text-base sm:text-lg md:text-xl text-slate-700 max-w-xl sm:max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed font-medium px-2"
          style={{ textWrap: "pretty" }}
        >
          Yukti — India's AI Health companion, built for the World; powered by{" "}
          <span className="font-semibold text-violet-700 whitespace-nowrap">modern intelligence</span>,
          and anchored in the{" "}
          <span className="font-semibold text-amber-700 whitespace-nowrap">timeless wisdom</span>{" "}
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
