import { Link } from "wouter";
import { ArrowRight, Target, Eye, HeartHandshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageShell from "./PageShell";

const VALUES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Target,
    title: "Our mission",
    desc: "Make trustworthy health guidance accessible to every Indian family — regardless of location, language or income.",
  },
  {
    icon: Eye,
    title: "Our vision",
    desc: "A world where no one makes a critical health decision alone or in the dark.",
  },
  {
    icon: HeartHandshake,
    title: "Our values",
    desc: "Empathy, accuracy, privacy and accessibility — in every feature we build.",
  },
];

const STATS: { value: string; label: string }[] = [
  { value: "20+", label: "Specialised communities" },
  { value: "Yukti", label: "AI health companion" },
  { value: "Bilingual", label: "English & हिंदी" },
];

export default function About() {
  return (
    <PageShell
      documentTitle="About — HealthCircle"
      metaDescription="HealthCircle is India's first AI-powered health companion — combining community wisdom, AI clarity and professional expertise."
      eyebrow="About HealthCircle"
      title={<>Built for the <span className="italic text-indigo-700">real conversations</span> healthcare needs.</>}
      intro="HealthCircle is India's first AI-powered health companion — built for real people navigating real challenges. We combine community wisdom, AI clarity and professional expertise."
    >
      <section className="px-4 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-4 mb-14 md:mb-20">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 border border-slate-200">
                <p className="font-serif text-3xl text-slate-900 leading-none">{s.value}</p>
                <p className="text-sm text-slate-500 mt-2">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="bg-white rounded-3xl p-7 md:p-8 border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 ring-1 ring-indigo-100 flex items-center justify-center mb-6">
                    <Icon className="h-5 w-5 text-indigo-700" strokeWidth={1.75} />
                  </div>
                  <h3 className="font-serif text-[22px] text-slate-900 mb-3">{v.title}</h3>
                  <p className="text-[15px] text-slate-600 leading-relaxed">{v.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-14 md:mt-20 rounded-3xl bg-slate-900 text-white p-10 md:p-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="font-serif text-2xl md:text-[32px] leading-tight tracking-[-0.01em]">
                Want to help us build it?
              </h3>
              <p className="text-slate-300 mt-3 text-[15px]">
                Whether you're a doctor, hospital, health brand or curious patient — we'd love to hear from you.
              </p>
            </div>
            <Link
              href="/support"
              className="group inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-900 rounded-full font-semibold text-base hover:bg-slate-100 self-start md:self-auto"
            >
              Get in touch
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
