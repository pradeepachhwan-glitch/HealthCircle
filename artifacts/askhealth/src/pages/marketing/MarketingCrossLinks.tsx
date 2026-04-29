import { Link, useLocation } from "wouter";
import { ArrowUpRight } from "lucide-react";

const ALL_LINKS: { href: string; eyebrow: string; title: string; desc: string; tone: string }[] = [
  {
    href: "/solutions",
    eyebrow: "Solutions",
    title: "Everything we offer",
    desc: "AI guidance, communities and verified doctors — in one calm place.",
    tone: "from-indigo-50 to-white",
  },
  {
    href: "/for-doctors",
    eyebrow: "For Doctors",
    title: "MedPro workspace",
    desc: "Review urgent AI cases, validate summaries, support patients.",
    tone: "from-emerald-50 to-white",
  },
  {
    href: "/about",
    eyebrow: "About",
    title: "Our mission",
    desc: "How HealthCircle is rebuilding healthcare for India.",
    tone: "from-rose-50 to-white",
  },
  {
    href: "/support",
    eyebrow: "Support",
    title: "Get in touch",
    desc: "Email, WhatsApp or talk to our doctor onboarding team.",
    tone: "from-amber-50 to-white",
  },
];

/**
 * Cross-page navigation card row that appears at the bottom of every public
 * marketing sub-page. Filters out the page the user is currently on so we
 * always show three "next places to go" plus a friendly "back home" CTA.
 */
export function MarketingCrossLinks() {
  const [location] = useLocation();
  const others = ALL_LINKS.filter((l) => l.href !== location);

  return (
    <section className="border-t border-slate-200 bg-slate-50/40">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">
              Continue exploring
            </p>
            <h2 className="font-serif text-2xl md:text-[34px] leading-[1.1] text-slate-900 tracking-[-0.015em]">
              More from HealthCircle.
            </h2>
          </div>
          <Link
            href="/#try-yukti"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:gap-2 transition-all self-start md:self-auto"
          >
            Try Yukti free
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {others.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group relative flex flex-col bg-white rounded-2xl border border-slate-200 p-6 hover:border-slate-300 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className={`absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br ${l.tone} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">
                {l.eyebrow}
              </p>
              <h3 className="font-serif text-xl text-slate-900 mb-2 leading-snug">
                {l.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed flex-1">{l.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:gap-2 transition-all mt-5">
                Open
                <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
