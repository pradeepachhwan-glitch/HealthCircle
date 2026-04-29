import { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/Reveal";
import { HOW_IT_WORKS } from "../data";

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion();

  // Fill a vertical/horizontal gradient line as the user scrolls past this section.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 80%", "end 30%"],
  });
  const lineProgress = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const dotProgress = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section className="relative bg-warm-wash border-y border-slate-200/70 py-20 md:py-28 px-4">
      <div className="relative max-w-5xl mx-auto">
        <Reveal className="text-center mb-14 md:mb-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-700 mb-3">
            How it works
          </p>
          <h2 className="font-serif text-3xl md:text-[40px] leading-[1.1] text-slate-900 tracking-[-0.015em]">
            From a worried question to a clear next step.
          </h2>
        </Reveal>

        <div ref={containerRef} className="relative">
          {/* Mobile: vertical track on the left */}
          <div className="md:hidden absolute left-4 top-0 bottom-0 w-px bg-slate-200" aria-hidden>
            <motion.div
              className="absolute left-0 top-0 w-full bg-gradient-to-b from-violet-500 via-cyan-500 to-emerald-500"
              style={{ height: reduce ? "100%" : lineProgress }}
            />
            <motion.span
              className="absolute -left-[5px] w-[11px] h-[11px] rounded-full bg-emerald-500 ring-4 ring-emerald-100"
              style={{ top: reduce ? "100%" : dotProgress, translateY: "-50%" }}
            />
          </div>

          {/* Desktop: horizontal track across all 4 columns */}
          <div className="hidden md:block absolute left-0 right-0 top-3.5 h-px bg-slate-200" aria-hidden>
            <motion.div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500"
              style={{ width: reduce ? "100%" : lineProgress }}
            />
            <motion.span
              className="absolute top-0 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
              style={{ left: reduce ? "100%" : dotProgress, translateX: "-50%" }}
            />
          </div>

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12 pl-10 md:pl-0">
            {HOW_IT_WORKS.map((item, idx) => (
              <Reveal
                key={item.step}
                delay={idx * 0.08}
                className="relative"
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 via-violet-600 to-rose-600 font-serif text-base text-white leading-none shadow-md shadow-indigo-500/40 ring-2 ring-white"
                    whileHover={reduce ? undefined : { scale: 1.15, rotate: 6 }}
                    transition={reduce ? undefined : { type: "spring", stiffness: 320, damping: 14 }}
                  >
                    {item.step}
                  </motion.span>
                </div>
                <h3 className="font-serif text-lg text-slate-900 mb-2 leading-snug">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed">{item.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
