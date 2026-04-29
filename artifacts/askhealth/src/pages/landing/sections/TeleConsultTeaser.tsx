import { Link } from "wouter";
import {
  ArrowRight,
  Video,
  Stethoscope,
  ShieldCheck,
  Pill,
  Sparkles,
} from "lucide-react";

const STEPS: {
  icon: typeof Video;
  label: string;
  desc: string;
  /** Distinct accent so each step pops instead of merging into a wall of green. */
  iconWrap: string;
}[] = [
  {
    icon: Stethoscope,
    label: "AI triage by Yukti",
    desc: "Quick 4-step check assigns severity & specialty.",
    iconWrap: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30",
  },
  {
    icon: Video,
    label: "Video, audio or chat",
    desc: "Choose how you want to talk to your doctor.",
    iconWrap: "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/30",
  },
  {
    icon: Pill,
    label: "Digital prescription",
    desc: "Saved to your health records, with red-flag warnings.",
    iconWrap: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/30",
  },
  {
    icon: ShieldCheck,
    label: "Consent-first",
    desc: "Your data is shared only after you explicitly approve.",
    iconWrap: "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-500/30",
  },
];

export function TeleConsultTeaser() {
  return (
    <section
      className="relative py-20 md:py-28 px-4 overflow-hidden"
      data-testid="tele-consult-section"
    >
      {/* Bold accent backdrop — emerald + cyan radial glow so the section
          reads as a confident anchor on the page, not a quiet aside. */}
      <div className="absolute inset-0 -z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 via-white to-cyan-50/70" />
        <div className="absolute -top-24 left-1/4 h-[420px] w-[420px] rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 h-[420px] w-[420px] rounded-full bg-cyan-200/40 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-14 md:gap-20 items-center">
          <div className="order-2 md:order-1">
            <div className="rounded-3xl bg-white/90 backdrop-blur border border-emerald-200 p-6 md:p-8 shadow-[0_30px_70px_-30px_rgba(16,185,129,0.35)]">
              <div className="space-y-3">
                {STEPS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      className="flex items-start gap-4 bg-white rounded-2xl p-4 border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all"
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/40 ${s.iconWrap}`}>
                        <Icon className="h-5 w-5" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-[15px]">{s.label}</p>
                        <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="order-1 md:order-2">
            {/* Bolder eyebrow — gradient pill instead of pale tracking text */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-bold uppercase tracking-[0.18em] shadow-md shadow-emerald-500/30">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} />
              Tele-Consult
            </span>

            {/* Heavier weight + tighter tracking — was font-medium; now reads as a marquee headline */}
            <h2 className="font-serif text-4xl md:text-[48px] leading-[1.05] text-slate-900 tracking-[-0.02em] mb-5 font-bold">
              Talk to a verified doctor —{" "}
              <span className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 bg-clip-text text-transparent italic">
                in minutes
              </span>
              , from anywhere.
            </h2>

            <p className="text-[18px] text-slate-700 leading-relaxed max-w-md mb-8 font-medium">
              Start with a quick AI triage, get matched to the right specialist,
              and consult by video, audio or chat. Receive a digital prescription
              right after — all inside HealthCircle.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/#try-yukti"
                className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-full font-bold text-[15px] hover:from-emerald-700 hover:to-teal-700 shadow-[0_12px_30px_-8px_rgba(16,185,129,0.6)] hover:shadow-[0_18px_40px_-8px_rgba(16,185,129,0.75)] hover:-translate-y-0.5 transition-all duration-200"
                data-testid="tele-consult-cta"
              >
                Book a tele-consult
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/solutions"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-slate-900 rounded-full font-semibold text-[15px] border border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-all"
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
