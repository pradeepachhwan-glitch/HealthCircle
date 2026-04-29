import { Link } from "wouter";
import {
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  Shield,
  Award,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageShell from "./PageShell";

const FEATURES: string[] = [
  "Urgent case alerts — high-risk AI flags delivered directly",
  "Patient consultation requests with clinical note responses",
  "AI Summary validation — review and approve health summaries",
  "Community moderation across health communities",
  "Verified professional badge to build community trust",
];

const TILES: { icon: LucideIcon; label: string; desc: string }[] = [
  { icon: AlertCircle, label: "Urgent cases", desc: "Real-time alerts for high-risk patients" },
  { icon: MessageSquare, label: "Patient requests", desc: "Direct consultation messaging" },
  { icon: CheckCircle2, label: "AI validation", desc: "Quality control on summaries" },
  { icon: Award, label: "Expert responses", desc: "Measurable community impact" },
];

export default function ForDoctors() {
  return (
    <PageShell
      documentTitle="For Doctors — HealthCircle MedPro"
      metaDescription="A focused workspace for verified medical professionals — review urgent AI cases, respond to patients and validate AI summaries."
      eyebrow="For Medical Professionals"
      title={<>A workspace built for <span className="italic text-indigo-700">healthcare providers</span>.</>}
      intro="HealthCircle's MedPro Portal gives you a focused space to review urgent cases, respond to patients, and validate AI summaries — without inbox chaos."
    >
      <section className="px-4 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16 items-start">
          <div>
            <h2 className="font-serif text-2xl md:text-[32px] text-slate-900 leading-tight tracking-[-0.01em] mb-6">
              What you'll do inside the portal.
            </h2>
            <ul className="space-y-3.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[15px] text-slate-700">
                  <span className="flex-shrink-0 mt-1 w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 mt-10">
              <Link
                href="/sign-in"
                className="group inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 text-white rounded-full font-semibold text-base hover:bg-slate-800"
              >
                Join as a Medical Professional
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-slate-800 rounded-full font-semibold text-base border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              >
                Talk to our team
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-cyan-50 border border-indigo-100/70 p-6 md:p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.18)]">
            <div className="space-y-3">
              {TILES.map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.label} className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-indigo-100/70">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4.5 w-4.5 text-indigo-700" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{t.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              Verified profile required. Manual review by our medical team.
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
