const STATS: { value: string; label: string }[] = [
  { value: "Yukti AI", label: "Always-on health companion" },
  { value: "Verified", label: "Doctors across India" },
  { value: "20+", label: "Communities by condition & life stage" },
  { value: "Bilingual", label: "English & हिंदी, more coming" },
];

export function TrustBand() {
  return (
    <section className="border-y border-slate-200 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 md:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center md:text-left">
              <p className="font-serif text-2xl md:text-[28px] text-slate-900 leading-none">
                {s.value}
              </p>
              <p className="text-xs md:text-[13px] text-slate-500 mt-2 leading-snug">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
