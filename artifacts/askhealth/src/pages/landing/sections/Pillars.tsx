import { Link } from "wouter";
import { Sparkles, Users, Stethoscope, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PILLARS: {
  icon: LucideIcon;
  title: string;
  desc: string;
  href: string;
  cta: string;
  tone: string;
  iconWrap: string;
  iconColor: string;
}[] = [
  {
    icon: Sparkles,
    title: "Yukti AI Companion",
    desc: "Instant, evidence-backed answers in English and Hindi. Yukti understands your symptoms, flags risk, and points you to the right next step — without medical jargon.",
    href: "/sign-in",
    cta: "Try Yukti free",
    tone: "from-indigo-50 to-white",
    iconWrap: "bg-indigo-50 ring-1 ring-indigo-100",
    iconColor: "text-indigo-700",
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
  },
  {
    icon: Stethoscope,
    title: "Verified doctors",
    desc: "Skip the waiting room. Browse verified specialists, see their fees and languages, then consult by video, audio or chat — with a digital prescription after.",
    href: "/sign-in",
    cta: "Book a tele-consult",
    tone: "from-emerald-50 to-white",
    iconWrap: "bg-emerald-50 ring-1 ring-emerald-100",
    iconColor: "text-emerald-700",
  },
];

export function Pillars() {
  return (
    <section className="py-20 md:py-28 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-12 md:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-4">
            Three calm ways to use HealthCircle
          </p>
          <h2 className="font-serif text-3xl md:text-[44px] leading-[1.08] text-slate-900 tracking-[-0.015em]">
            Care that meets you where you are.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <Link
                key={p.title}
                href={p.href}
                className="group relative flex flex-col bg-white rounded-3xl border border-slate-200 p-7 md:p-8 hover:border-slate-300 hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.18)] transition-all duration-300"
              >
                <div className={`absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br ${p.tone} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className={`w-12 h-12 rounded-2xl ${p.iconWrap} flex items-center justify-center mb-6`}>
                  <Icon className={`h-5 w-5 ${p.iconColor}`} strokeWidth={1.75} />
                </div>
                <h3 className="font-serif text-[22px] md:text-2xl text-slate-900 mb-3 leading-snug">
                  {p.title}
                </h3>
                <p className="text-[15px] text-slate-600 leading-relaxed mb-8 flex-1">
                  {p.desc}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:gap-2 transition-all">
                  {p.cta}
                  <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
