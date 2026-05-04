import { Link, useLocation } from "wouter";
import { Building2, UserRound } from "lucide-react";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import type { AccountType } from "@workspace/replit-auth-web";

const accountOptions: Array<{
  type: AccountType;
  title: string;
  description: string;
  cta: string;
  icon: typeof UserRound;
  accent: string;
}> = [
  {
    type: "personal",
    title: "Personal account",
    description: "For patients, families, caregivers, and community members using HealthCircle for everyday health support.",
    cta: "Continue as personal",
    icon: UserRound,
    accent: "from-blue-500 to-cyan-400",
  },
  {
    type: "hospital",
    title: "Hospital account",
    description: "For hospitals, clinics, and care teams. Your hospital workspace is ready for content and services we will add next.",
    cta: "Continue as hospital",
    icon: Building2,
    accent: "from-rose-500 to-orange-400",
  },
];

export default function AccountTypePage() {
  const [, setLocation] = useLocation();

  function choose(type: AccountType) {
    try {
      window.localStorage.setItem("healthcircle:lastAccountType", type);
    } catch {
      /* best effort */
    }
    setLocation(`/sign-in?accountType=${type}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-rose-50/40 to-blue-50/60 px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex mb-5">
            <HealthCircleLogo size="md" animate={false} />
          </div>
          <h1 className="text-3xl font-bold text-slate-950">Welcome to HealthCircle</h1>
          <p className="mt-3 text-lg text-slate-600">Select your account type to continue</p>
        </div>

        <div className="space-y-5">
          {accountOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.type}
                type="button"
                onClick={() => choose(option.type)}
                className="w-full text-left bg-white/90 backdrop-blur rounded-3xl border border-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-6"
                data-testid={`account-type-${option.type}`}
              >
                <div className="flex gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${option.accent} flex items-center justify-center text-white shadow-sm shrink-0`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-slate-950">{option.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{option.description}</p>
                  </div>
                </div>
                <div className="mt-6 rounded-full border border-primary/60 text-primary font-semibold text-center py-3">
                  {option.cta}
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Already signed in?{" "}
          <Link href="/communities" className="text-primary hover:underline">
            Go to HealthCircle
          </Link>
        </p>
      </div>
    </div>
  );
}
