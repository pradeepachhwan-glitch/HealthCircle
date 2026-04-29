import { Link } from "wouter";
import {
  Sparkles,
  Users,
  Stethoscope,
  Trophy,
  Lock,
  Globe,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageShell from "./PageShell";

const SOLUTIONS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Sparkles,
    title: "Yukti AI Companion",
    desc: "Instant, evidence-backed answers. Yukti understands symptoms, flags risk levels, and guides next steps — in English and Hindi.",
  },
  {
    icon: Users,
    title: "Health communities",
    desc: "20+ specialised communities — diabetes, heart, mental wellness, pregnancy. Share with people who truly understand.",
  },
  {
    icon: Stethoscope,
    title: "Doctor network",
    desc: "Find verified doctors and book appointments. View availability, fees and specialties from one place.",
  },
  {
    icon: Trophy,
    title: "A gentle journey",
    desc: "Earn Health Credits, level up, collect badges and celebrate milestones while learning more about your health.",
  },
  {
    icon: Lock,
    title: "Privacy-first",
    desc: "Your health data stays private. Enterprise-grade security. We never sell your information to third parties.",
  },
  {
    icon: Globe,
    title: "Multi-language",
    desc: "English and Hindi today, more languages on the way — because health guidance should reach everyone.",
  },
];

export default function Solutions() {
  return (
    <PageShell
      documentTitle="Solutions — HealthCircle"
      metaDescription="AI guidance, trusted communities and verified doctors — woven into one calm, India-first healthcare product."
      eyebrow="Solutions"
      title={<>Everything you need for <span className="italic text-indigo-700">smarter</span> healthcare.</>}
      intro="AI guidance, community wisdom and professional expertise — woven into one calm, India-first product."
    >
      <section className="px-4 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-5">
          {SOLUTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="bg-white rounded-3xl p-7 md:p-8 border border-slate-200 hover:border-slate-300 hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.18)] transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center mb-6">
                  <Icon className="h-5 w-5 text-slate-700" strokeWidth={1.75} />
                </div>
                <h3 className="font-serif text-[22px] text-slate-900 mb-3 leading-snug">
                  {s.title}
                </h3>
                <p className="text-[15px] text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="max-w-6xl mx-auto mt-14 md:mt-16 rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl">
            <h3 className="font-serif text-2xl md:text-[32px] leading-tight tracking-[-0.01em]">
              Ready to ask your first question?
            </h3>
            <p className="text-slate-300 mt-3 text-[15px]">
              Yukti is free forever. No credit card needed.
            </p>
          </div>
          <Link
            href="/sign-in"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 rounded-full font-semibold text-base hover:bg-slate-100 self-start md:self-auto"
          >
            Try Yukti free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
