import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { LandingYuktiDemo } from "@/components/LandingYuktiDemo";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Decorative background — One Medical-style thin curve + soft tint */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-32 -right-40 h-[640px] w-[640px] rounded-full bg-gradient-to-br from-indigo-50 via-white to-transparent blur-3xl" />
        <svg
          aria-hidden
          className="absolute -top-24 right-0 h-[820px] w-[820px] text-indigo-200/70"
          viewBox="0 0 800 800"
          fill="none"
        >
          <circle cx="400" cy="400" r="360" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="400" cy="400" r="280" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 6" />
        </svg>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-16 md:pt-28 md:pb-24 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-6">
          India's AI Health Companion
        </p>

        <h1 className="font-serif text-[42px] leading-[1.05] sm:text-5xl md:text-6xl lg:text-[72px] lg:leading-[1.02] font-medium text-slate-900 tracking-[-0.02em] mb-6">
          Healthcare clarity,
          <br className="hidden sm:block" />{" "}
          <span className="italic text-indigo-700">the moment</span> you need it.
        </h1>

        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Ask Yukti — India's AI health companion. Get evidence-backed answers,
          join trusted communities, and consult verified doctors.{" "}
          <span className="text-slate-500">All in one calm place.</span>
        </p>

        <div className="flex items-center justify-center gap-5 flex-wrap mb-5">
          <Link
            href="/sign-in"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-slate-900 text-white rounded-full font-semibold text-base hover:bg-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(15,23,42,0.45)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_12px_28px_-10px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 transition-all duration-200"
            data-testid="hero-primary-cta"
          >
            Try Yukti free
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline"
          >
            or sign in
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          Free forever · No credit card · English & हिंदी
        </p>

        {/* Live product proof — the Yukti demo widget */}
        <div className="mt-14 md:mt-16">
          <LandingYuktiDemo />
        </div>
      </div>
    </section>
  );
}
