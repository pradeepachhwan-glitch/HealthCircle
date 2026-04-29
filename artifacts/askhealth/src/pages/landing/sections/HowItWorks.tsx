import { HOW_IT_WORKS } from "../data";

export function HowItWorks() {
  return (
    <section className="bg-slate-50/60 border-y border-slate-200 py-20 md:py-28 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14 md:mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
            How it works
          </p>
          <h2 className="font-serif text-3xl md:text-[40px] leading-[1.1] text-slate-900 tracking-[-0.015em]">
            From a worried question to a clear next step.
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12">
          {HOW_IT_WORKS.map((item, idx) => (
            <div key={item.step} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-serif text-3xl text-indigo-700/90 leading-none">
                  {item.step}
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <h3 className="font-serif text-lg text-slate-900 mb-2 leading-snug">
                {item.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              {idx < HOW_IT_WORKS.length - 1 && (
                <span className="hidden md:block absolute top-3.5 -right-4 text-slate-300 text-xs">
                  ›
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
