import { Link } from "wouter";
import {
  ArrowRight,
  Video,
  Stethoscope,
  ShieldCheck,
  Pill,
} from "lucide-react";

const STEPS: {
  icon: typeof Video;
  label: string;
  desc: string;
}[] = [
  {
    icon: Stethoscope,
    label: "AI triage by Yukti",
    desc: "Quick 4-step check assigns severity & specialty.",
  },
  {
    icon: Video,
    label: "Video, audio or chat",
    desc: "Choose how you want to talk to your doctor.",
  },
  {
    icon: Pill,
    label: "Digital prescription",
    desc: "Saved to your health records, with red-flag warnings.",
  },
  {
    icon: ShieldCheck,
    label: "Consent-first",
    desc: "Your data is shared only after you explicitly approve.",
  },
];

export function TeleConsultTeaser() {
  return (
    <section className="py-20 md:py-28 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-14 md:gap-20 items-center">
          <div className="order-2 md:order-1">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-cyan-50 border border-emerald-100/70 p-6 md:p-8 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.18)]">
              <div className="space-y-3">
                {STEPS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-emerald-100/70"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4.5 w-4.5 text-emerald-700" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{s.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 mb-4">
              Tele-Consult
            </p>
            <h2 className="font-serif text-3xl md:text-[42px] leading-[1.1] text-slate-900 tracking-[-0.015em] mb-5">
              Talk to a verified doctor — in minutes, from anywhere.
            </h2>
            <p className="text-[17px] text-slate-600 leading-relaxed max-w-md mb-8">
              Start with a quick AI triage, get matched to the right specialist,
              and consult by video, audio or chat. Receive a digital prescription
              right after — all inside HealthCircle.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/#try-yukti"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-full font-semibold text-sm hover:bg-slate-800 shadow-sm hover:-translate-y-0.5 transition-all"
              >
                Book a tele-consult
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-800 rounded-full font-semibold text-sm border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
              >
                See all solutions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
