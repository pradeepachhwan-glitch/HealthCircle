import { Reveal, RevealStagger } from "@/components/Reveal";
import { CountUp } from "@/components/CountUp";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, ShieldCheck, Users, Languages } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Stat {
  icon: LucideIcon;
  value: string;
  numericEnd?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  iconBg: string;
  iconColor: string;
}

const STATS: Stat[] = [
  {
    icon: Sparkles,
    value: "Yukti AI",
    label: "Always-on health companion",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
  },
  {
    icon: ShieldCheck,
    numericEnd: 500,
    suffix: "+",
    value: "",
    label: "Verified doctors across India",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: Users,
    numericEnd: 20,
    suffix: "+",
    value: "",
    label: "Communities by condition & life stage",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  {
    icon: Languages,
    value: "Bilingual",
    label: "English & हिंदी, more coming",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
];

export function TrustBand() {
  const reduce = useReducedMotion();
  return (
    <section className="border-y border-slate-200 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-14">
        <RevealStagger className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.label} as="div" className="flex flex-col items-center md:items-start text-center md:text-left">
                <motion.div
                  whileHover={reduce ? undefined : { scale: 1.08, rotate: -4 }}
                  transition={reduce ? undefined : { type: "spring", stiffness: 320, damping: 14 }}
                  className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center mb-3`}
                >
                  <Icon className={`h-5 w-5 ${s.iconColor}`} strokeWidth={2} />
                </motion.div>
                <p className="font-serif text-2xl md:text-[28px] text-slate-900 leading-none tabular-nums">
                  {s.numericEnd !== undefined ? (
                    <CountUp
                      end={s.numericEnd}
                      prefix={s.prefix}
                      suffix={s.suffix}
                    />
                  ) : (
                    s.value
                  )}
                </p>
                <p className="text-xs md:text-[13px] text-slate-500 mt-2 leading-snug max-w-[18ch]">
                  {s.label}
                </p>
              </Reveal>
            );
          })}
        </RevealStagger>
      </div>
    </section>
  );
}
