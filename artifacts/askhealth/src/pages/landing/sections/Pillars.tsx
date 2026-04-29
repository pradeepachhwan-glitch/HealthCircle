import { Link } from "wouter";
import { Sparkles, Users, Stethoscope, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, RevealStagger } from "@/components/Reveal";
import { TiltCard } from "@/components/TiltCard";

const PILLARS: {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
  cta: string;
  tone: string;
  iconWrap: string;
  iconColor: string;
  accent: string;
}[] = [
  {
    icon: Sparkles,
    title: "Yukti AI Companion",
    desc: "Instant, evidence-backed answers in English and Hindi. Yukti understands your symptoms, flags risk, and points you to the right next step — without medical jargon.",
    href: "/#try-yukti",
    cta: "Try Yukti free",
    tone: "from-indigo-50 to-white",
    iconWrap: "bg-indigo-50 ring-1 ring-indigo-100",
    iconColor: "text-indigo-700",
    accent: "rgba(99,102,241,0.18)",
  },
  {
    icon: Users,
    title: "Trusted communities",
    desc: "20+ specialised circles for diabetes, heart, mental wellness, pregnancy and more. Read what real people lived through, not what an algorithm guessed.",
    href: "/solutions",
    cta: "Browse communities",
    tone: "from-rose-50 to-white",
    iconWrap: "bg-rose-50 ring-1 ring-rose-100",
    iconColor: "text-rose-700",
    accent: "rgba(244,63,94,0.18)",
  },
  {
    icon: Stethoscope,
    title: "Verified doctors",
    desc: "Skip the waiting room. Browse verified specialists, see their fees and languages, then consult by video, audio or chat — with a digital prescription after.",
    href: "/providers",
    cta: "Book a tele-consult",
    tone: "from-emerald-50 to-white",
    iconWrap: "bg-emerald-50 ring-1 ring-emerald-100",
    iconColor: "text-emerald-700",
    accent: "rgba(16,185,129,0.18)",
  },
];

export function Pillars() {
  const reduce = useReducedMotion();
  return (
    <section className="py-20 md:py-28 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <Reveal className="max-w-2xl mb-12 md:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Three calm ways to use HealthCircle
          </p>
          <h2 className="font-serif text-3xl md:text-[44px] leading-[1.08] text-slate-900 tracking-[-0.015em]">
            Care that meets you where you are.
          </h2>
        </Reveal>

        <RevealStagger className="grid md:grid-cols-3 gap-5">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} className="h-full">
                <TiltCard maxTilt={5} className="group h-full rounded-3xl">
                  <Link
                    href={p.href}
                    className="group relative flex flex-col h-full bg-white rounded-3xl border border-slate-200 p-7 md:p-8 hover:border-slate-300 hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow] duration-300 overflow-hidden"
                  >
                    {/* Tinted gradient that appears on hover */}
                    <div className={`absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br ${p.tone} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                    {/* Animated icon with floating glow */}
                    <div className="relative mb-6" style={{ transform: "translateZ(20px)" }}>
                      <motion.div
                        aria-hidden
                        className="absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-80 transition-opacity duration-300"
                        style={{ background: p.accent }}
                      />
                      <motion.div
                        className={`relative w-12 h-12 rounded-2xl ${p.iconWrap} flex items-center justify-center`}
                        whileHover={reduce ? undefined : { rotate: [0, -6, 6, -3, 0], scale: 1.06 }}
                        transition={reduce ? undefined : { duration: 0.6, ease: "easeInOut" }}
                      >
                        <Icon className={`h-5 w-5 ${p.iconColor}`} strokeWidth={1.75} />
                      </motion.div>
                    </div>
                    <h3
                      className="font-serif text-[22px] md:text-2xl text-slate-900 mb-3 leading-snug"
                      style={{ transform: "translateZ(15px)" }}
                    >
                      {p.title}
                    </h3>
                    <p
                      className="text-[15px] text-slate-600 leading-relaxed mb-8 flex-1"
                      style={{ transform: "translateZ(8px)" }}
                    >
                      {p.desc}
                    </p>
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:gap-2 transition-all"
                      style={{ transform: "translateZ(15px)" }}
                    >
                      {p.cta}
                      <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </Link>
                </TiltCard>
              </Reveal>
            );
          })}
        </RevealStagger>
      </div>
    </section>
  );
}
