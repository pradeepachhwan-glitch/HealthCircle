import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { COMMUNITIES_PREVIEW } from "../data";

export function CommunitiesPreview() {
  return (
    <section className="bg-slate-50/60 border-y border-slate-200 py-20 md:py-28 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-14">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
              Communities
            </p>
            <h2 className="font-serif text-3xl md:text-[40px] leading-[1.1] text-slate-900 tracking-[-0.015em]">
              Find people who've been through what you're going through.
            </h2>
          </div>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:gap-2 transition-all"
          >
            See all 20 communities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
          {COMMUNITIES_PREVIEW.map((c) => (
            <Link
              key={c.slug}
              href="/sign-in"
              className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className={`bg-gradient-to-br ${c.accent} h-32 flex items-center justify-center overflow-hidden`}>
                <img
                  src={c.img}
                  alt={c.name}
                  className="h-24 w-24 object-contain group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  {c.tag}
                </p>
                <h3 className="font-serif text-lg text-slate-900 mb-1">{c.name}</h3>
                <p className="text-sm text-slate-500">{c.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
