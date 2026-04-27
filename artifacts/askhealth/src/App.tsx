import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import React, { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { useGetCurrentUser } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Communities from "@/pages/communities";
import Community from "@/pages/community";
import PostDetail from "@/pages/post";
import Profile from "@/pages/profile";
import Search from "@/pages/search";
import Admin from "@/pages/admin";
import Broadcast from "@/pages/broadcast";
import ChatPage from "@/pages/chat";
import ProvidersPage from "@/pages/providers";
import AppointmentsPage from "@/pages/appointments";
import OnboardingFlow from "@/components/OnboardingFlow";
import MedPro from "@/pages/medpro";
import { useUser } from "@clerk/react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        if ((error as any)?.status === 401) return false;
        return failureCount < 1;
      },
    },
  },
});

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/favicon.svg`,
  },
  variables: {
    colorPrimary: "hsl(174, 84%, 31%)",
    colorForeground: "hsl(222, 47%, 11%)",
    colorMutedForeground: "hsl(215.4, 16.3%, 46.9%)",
    colorDanger: "hsl(0, 84.2%, 60.2%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(0, 0%, 100%)",
    colorInputForeground: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(214, 32%, 91%)",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary hover:text-primary/90 font-medium",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-green-600",
    alertText: "text-destructive-foreground",
    logoBox: "mb-6",
    logoImage: "h-8 w-auto",
    socialButtonsBlockButton: "border-border hover:bg-muted/50",
    formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90 font-medium",
    formFieldInput: "border-input bg-background focus:ring-ring",
    footerAction: "pt-6 pb-2",
    dividerLine: "bg-border",
    alert: "bg-destructive text-destructive-foreground border-destructive-border",
    otpCodeFieldInput: "border-input",
    formFieldRow: "space-y-4",
    main: "p-8",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

const COMMUNITIES_PREVIEW = [
  { emoji: "🧠", name: "Mind Space", desc: "Talk, share, heal", slug: "mental-wellness" },
  { emoji: "🩸", name: "Sugar Care", desc: "Manage diabetes better", slug: "diabetes-care" },
  { emoji: "🤰", name: "Mom Journey", desc: "Pregnancy to parenting", slug: "pregnancy-motherhood" },
  { emoji: "💼", name: "Work Reset", desc: "Beat stress & burnout", slug: "work-stress-burnout" },
  { emoji: "🏃", name: "Fit Life", desc: "Fitness your way", slug: "weight-loss-fitness" },
  { emoji: "❤️", name: "Heart Circle", desc: "Care for your heart", slug: "heart-health" },
];

const TRENDING_QUESTIONS = [
  { q: "Why do I feel anxious at night?", community: "Mind Space", replies: 12 },
  { q: "PCOS weight gain solutions?", community: "Cycle Sync", replies: 8 },
  { q: "Chest pain after gym — should I worry?", community: "Heart Circle", replies: 5 },
  { q: "Best diet for Type 2 diabetes?", community: "Sugar Care", replies: 19 },
];

const HOW_IT_WORKS = [
  { step: "1", title: "Join a community", desc: "Find your tribe — by condition, goal, or life stage." },
  { step: "2", title: "Ask your question", desc: "Share what you're experiencing. No judgment, just help." },
  { step: "3", title: "Get AI clarity", desc: "Yukti AI summarises answers, flags risk, and guides next steps." },
  { step: "4", title: "Take action", desc: "Book a doctor, follow up, or explore similar threads." },
];

function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 flex items-center justify-between bg-white/90 backdrop-blur border-b sticky top-0 z-20">
        <button onClick={() => scrollTo("hero")} className="cursor-pointer">
          <HealthCircleLogo size="sm" animate={false} />
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button onClick={() => scrollTo("solutions")} className="hover:text-primary transition-colors">Solutions</button>
          <button onClick={() => scrollTo("for-doctors")} className="hover:text-primary transition-colors">For Doctors</button>
          <button onClick={() => scrollTo("about")} className="hover:text-primary transition-colors">About</button>
          <button onClick={() => scrollTo("support")} className="hover:text-primary transition-colors">Support</button>
        </nav>

        <div className="hidden md:flex gap-3">
          <Link href="/sign-in" className="text-sm font-medium px-4 py-2 hover:text-primary transition-colors text-slate-600">Sign In</Link>
          <Link href="/sign-up" className="text-sm font-medium px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">Get Started Free</Link>
        </div>

        {/* Mobile Menu Button */}
        <button onClick={() => setMobileMenuOpen(v => !v)} className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[61px] left-0 right-0 z-10 bg-white border-b shadow-lg p-4 space-y-2">
          {[["solutions", "Solutions"], ["for-doctors", "For Doctors"], ["about", "About"], ["support", "Support"]].map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors">
              {label}
            </button>
          ))}
          <div className="pt-2 border-t flex gap-2">
            <Link href="/sign-in" className="flex-1 text-center text-sm font-medium px-4 py-2 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50">Sign In</Link>
            <Link href="/sign-up" className="flex-1 text-center text-sm font-medium px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">Get Started</Link>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* HERO */}
        <section id="hero" className="max-w-4xl mx-auto text-center px-4 pt-16 pb-14">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            AI Health Guidance • Multi-language • India-first
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-5 leading-tight">
            Ask. Share. Learn.<br />
            <span className="text-primary">Act on your health.</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Join trusted health communities, ask real questions, get AI-backed clarity, and take the right next step — without confusion.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/sign-up" className="px-7 py-3.5 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary/90 transition-all shadow-md hover:shadow-lg">
              Join a Community
            </Link>
            <Link href="/sign-up" className="px-7 py-3.5 bg-white text-slate-900 rounded-xl font-semibold text-base border border-slate-200 hover:bg-slate-50 transition-all">
              Ask a Question
            </Link>
          </div>
        </section>

        {/* COMMUNITIES GRID */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Explore Communities that Understand You</h2>
            <p className="text-slate-500 mt-1">Real people. Real experiences. Backed by AI clarity.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {COMMUNITIES_PREVIEW.map(c => (
              <Link key={c.slug} href="/sign-up">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group">
                  <div className="text-3xl mb-3">{c.emoji}</div>
                  <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-primary transition-colors">{c.name}</h3>
                  <p className="text-sm text-slate-500 mb-3">{c.desc}</p>
                  <span className="text-xs font-semibold text-primary">Join →</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link href="/sign-up" className="text-sm text-primary font-medium hover:underline">
              See all 20 communities →
            </Link>
          </div>
        </section>

        {/* TRENDING QUESTIONS */}
        <section className="bg-slate-50 border-y border-slate-100 py-14 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">What people are asking right now</h2>
            <p className="text-slate-500 mb-6 text-sm">Real questions from real users — answered by the community and Yukti AI.</p>
            <div className="space-y-3">
              {TRENDING_QUESTIONS.map((item, i) => (
                <Link key={i} href="/sign-up">
                  <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer flex items-center justify-between gap-4 group">
                    <div>
                      <p className="text-slate-900 font-medium group-hover:text-primary transition-colors">{item.q}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.community}</p>
                    </div>
                    <div className="shrink-0 text-xs text-slate-400 font-medium">{item.replies} replies</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-4xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">How it works</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(item => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-extrabold text-lg flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SOLUTIONS */}
        <section id="solutions" className="bg-slate-50 border-y border-slate-100 py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">Everything you need for smarter healthcare</h2>
              <p className="text-slate-500 max-w-2xl mx-auto">HealthCircle combines AI, community wisdom, and professional expertise into one seamless platform.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "🤖", title: "Yukti AI Health Assistant", desc: "Get instant, evidence-based answers to your health questions. Yukti understands symptoms, flags risk levels, and suggests when to see a doctor — in English and Hindi." },
                { icon: "👥", title: "Trusted Health Communities", desc: "20+ specialized communities for diabetes, heart health, mental wellness, pregnancy, and more. Share experiences with people who truly understand." },
                { icon: "🩺", title: "Doctor Network & Booking", desc: "Find verified doctors and hospitals. Book appointments directly, view availability, fees, and specialties — all from one place." },
                { icon: "🏆", title: "Gamified Health Journey", desc: "Earn Health Credits for contributions. Level up, earn badges, and climb leaderboards while improving your health knowledge." },
                { icon: "🔒", title: "Privacy-First Design", desc: "Your health data stays private. We use enterprise-grade security and never sell your information. Share only what you choose." },
                { icon: "🌐", title: "Multi-language Support", desc: "Available in English and Hindi. More languages coming soon — because healthcare guidance should reach everyone." },
              ].map(s => (
                <div key={s.title} className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="text-3xl mb-4">{s.icon}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOR DOCTORS */}
        <section id="for-doctors" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">🩺 For Medical Professionals</div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">A dedicated portal built for healthcare providers</h2>
                <p className="text-slate-600 mb-6 leading-relaxed">HealthCircle's MedPro Portal gives doctors and medical professionals a powerful workspace to review urgent cases, respond to patient questions, and validate AI summaries.</p>
                <ul className="space-y-3">
                  {[
                    "Urgent case alerts — high-risk AI flags delivered directly to you",
                    "Patient consultation requests — respond with clinical notes",
                    "AI Summary validation — review and approve AI-generated health summaries",
                    "Community moderation — maintain quality across health communities",
                    "Verified professional badge — build trust with your community",
                  ].map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="text-primary font-bold mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link href="/sign-up" className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors">
                    Join as a Medical Professional →
                  </Link>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-100">
                <div className="space-y-4">
                  {[
                    { label: "Urgent Cases", value: "Real-time alerts", icon: "🚨" },
                    { label: "Patient Requests", value: "Direct consultations", icon: "👤" },
                    { label: "AI Validation", value: "Quality control", icon: "🤖" },
                    { label: "Expert Response", value: "Community impact", icon: "💬" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-4 bg-white rounded-xl p-4 border border-emerald-100">
                      <div className="text-2xl">{item.icon}</div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{item.label}</div>
                        <div className="text-xs text-slate-500">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="bg-slate-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">About HealthCircle</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  HealthCircle is India's first AI-powered healthcare super app — built for real people navigating real health challenges. We combine community wisdom, AI clarity, and professional expertise to help you make confident health decisions.
                </p>
                <p className="text-slate-300 leading-relaxed mb-6">
                  Founded on the belief that quality healthcare guidance should be accessible to everyone, HealthCircle bridges the gap between patients and professionals — in their language, on their schedule.
                </p>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {[["20+", "Communities"], ["Yukti AI", "Health Assistant"], ["Hindi + English", "Languages"]].map(([val, lbl]) => (
                    <div key={lbl} className="text-center">
                      <div className="text-xl font-extrabold text-primary">{val}</div>
                      <div className="text-xs text-slate-400 mt-1">{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { icon: "🎯", title: "Our Mission", desc: "Make trustworthy health guidance accessible to every Indian family — regardless of location, language, or income." },
                  { icon: "👁️", title: "Our Vision", desc: "A world where no one makes a critical health decision alone or in the dark." },
                  { icon: "💙", title: "Our Values", desc: "Empathy, accuracy, privacy, and accessibility — in every feature we build." },
                ].map(v => (
                  <div key={v.title} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                    <div className="text-xl mb-2">{v.icon}</div>
                    <div className="font-semibold text-white mb-1">{v.title}</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SUPPORT / CONTACT */}
        <section id="support" className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">We're here to help</h2>
              <p className="text-slate-500">Have a question, feedback, or need support? Reach out — we respond within 24 hours.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {[
                { icon: "📧", title: "Email Support", desc: "For general inquiries, account help, or technical issues.", link: "mailto:support@healthcircle.in", linkLabel: "support@healthcircle.in" },
                { icon: "🤝", title: "Partnerships", desc: "Hospitals, clinics, health brands — let's build together.", link: "mailto:partners@healthcircle.in", linkLabel: "partners@healthcircle.in" },
                { icon: "🩺", title: "Doctor Onboarding", desc: "Join as a verified medical professional and help thousands.", link: "/sign-up", linkLabel: "Apply for MedPro access" },
              ].map(c => (
                <div key={c.title} className="bg-white border border-slate-200 rounded-2xl p-6 text-center hover:border-primary/30 hover:shadow-md transition-all">
                  <div className="text-3xl mb-4">{c.icon}</div>
                  <h3 className="font-bold text-slate-900 mb-2">{c.title}</h3>
                  <p className="text-sm text-slate-500 mb-4 leading-relaxed">{c.desc}</p>
                  <a href={c.link} className="text-sm text-primary font-medium hover:underline">{c.linkLabel}</a>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
              <h3 className="font-bold text-slate-900 mb-2">Frequently Asked Questions</h3>
              <div className="space-y-3 text-left max-w-2xl mx-auto mt-4">
                {[
                  ["Is HealthCircle free?", "Yes, joining and participating is completely free. No credit card required."],
                  ["Is the AI a replacement for doctors?", "No. Yukti AI provides guidance and clarity, but always recommends seeing a doctor for serious concerns."],
                  ["Is my health data private?", "Absolutely. Your data is encrypted and never sold to third parties."],
                  ["Can I ask questions in Hindi?", "Yes, Yukti AI responds in both English and Hindi based on your preference."],
                  ["How do I become a verified doctor?", "Sign up, then contact us at support@healthcircle.in to get verified as a Medical Professional."],
                ].map(([q, a]) => (
                  <div key={q} className="bg-white rounded-xl p-4 border border-slate-200">
                    <div className="font-semibold text-slate-900 text-sm mb-1">{q}</div>
                    <p className="text-sm text-slate-500">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BLOCK / CTA */}
        <section className="bg-primary text-white py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-3xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-3">Your health data is private.</h2>
            <p className="text-primary-foreground/80 text-base mb-2">
              AI guidance is safe, structured, and not a replacement for doctors.
            </p>
            <p className="text-primary-foreground/60 text-sm mb-8">
              Free to join. No credit card needed. Available in English & Hindi.
            </p>
            <Link href="/sign-up" className="inline-block px-8 py-4 bg-white text-primary rounded-xl font-semibold text-lg hover:bg-white/90 transition-all">
              Get Started — It's Free
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-slate-50 border-t border-slate-100 py-8 px-4">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <HealthCircleLogo size="sm" animate={false} />
            <div className="flex flex-wrap gap-4 text-sm text-slate-500">
              <button onClick={() => scrollTo("about")} className="hover:text-primary transition-colors">About</button>
              <button onClick={() => scrollTo("solutions")} className="hover:text-primary transition-colors">Solutions</button>
              <button onClick={() => scrollTo("for-doctors")} className="hover:text-primary transition-colors">For Doctors</button>
              <button onClick={() => scrollTo("support")} className="hover:text-primary transition-colors">Support</button>
              <a href="mailto:support@healthcircle.in" className="hover:text-primary transition-colors">Contact</a>
            </div>
            <p className="text-xs text-slate-400">© 2025 HealthCircle. India-first healthcare.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useGetCurrentUser();
  const [bootstrapping, setBootstrapping] = React.useState(false);
  const [bootstrapStatus, setBootstrapStatus] = React.useState<{ adminExists: boolean } | null>(null);
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isLoading && user && user.role !== "admin") {
      fetch("/api/admin/bootstrap/status")
        .then(r => r.json())
        .then(setBootstrapStatus)
        .catch(() => {});
    }
  }, [isLoading, user]);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      const res = await fetch("/api/admin/bootstrap", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        await refetch();
      } else {
        setBootstrapError(data.error ?? "Failed to claim admin access.");
      }
    } catch {
      setBootstrapError("Network error. Please try again.");
    } finally {
      setBootstrapping(false);
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>;

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4 text-center">
        <div className="text-6xl">🔒</div>
        <h2 className="text-xl font-bold text-slate-700">Admin Access Required</h2>
        <p className="text-slate-500 max-w-sm">You need admin privileges to access this page.</p>

        {bootstrapStatus && !bootstrapStatus.adminExists && (
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl max-w-sm">
            <p className="text-sm text-slate-700 font-medium mb-1">No admin set up yet</p>
            <p className="text-xs text-slate-500 mb-3">You can claim the first admin seat since no admin account exists.</p>
            {bootstrapError && <p className="text-xs text-red-500 mb-2">{bootstrapError}</p>}
            <button
              onClick={handleBootstrap}
              disabled={bootstrapping}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {bootstrapping ? "Claiming…" : "Claim Admin Access"}
            </button>
          </div>
        )}

        {bootstrapStatus?.adminExists && (
          <p className="text-xs text-slate-400 max-w-sm">An admin already exists. Contact them to grant you access.</p>
        )}

        <Link href="/communities">
          <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 mt-2">
            Back to Communities
          </button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

function MedProGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading…</div>;
  if (user?.role !== "medical_professional" && user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4 text-center">
        <div className="text-6xl">🩺</div>
        <h2 className="text-xl font-bold text-slate-700">Medical Professional Access Required</h2>
        <p className="text-slate-500 max-w-sm">This portal is only available to verified Medical Professionals. Contact an admin to upgrade your account.</p>
        <Link href="/communities">
          <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 mt-2">Back to Communities</button>
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/communities" />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [done, setDone] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (!isLoaded || !user) return;
    const completed = localStorage.getItem(`onboarding_done_${user.id}`);
    setDone(!!completed);
  }, [isLoaded, user]);

  if (!isLoaded || !user || done === null) return null;
  if (!done) {
    return (
      <OnboardingFlow
        userId={user.id}
        onComplete={() => setDone(true)}
      />
    );
  }
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <OnboardingGate>{children}</OnboardingGate>
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to: string) => setLocation(stripBase(to))}
      routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          <Route path="/chat">
            <ProtectedRoute><ChatPage /></ProtectedRoute>
          </Route>

          <Route path="/providers">
            <ProtectedRoute><ProvidersPage /></ProtectedRoute>
          </Route>

          <Route path="/appointments">
            <ProtectedRoute><AppointmentsPage /></ProtectedRoute>
          </Route>

          <Route path="/communities">
            <ProtectedRoute><Communities /></ProtectedRoute>
          </Route>

          <Route path="/communities/:communityId">
            <ProtectedRoute><Community /></ProtectedRoute>
          </Route>

          <Route path="/communities/:communityId/post/:postId">
            <ProtectedRoute><PostDetail /></ProtectedRoute>
          </Route>

          <Route path="/search">
            <ProtectedRoute><Search /></ProtectedRoute>
          </Route>

          <Route path="/profile">
            <ProtectedRoute><Profile /></ProtectedRoute>
          </Route>

          <Route path="/medpro">
            <ProtectedRoute><MedProGate><MedPro /></MedProGate></ProtectedRoute>
          </Route>

          <Route path="/admin">
            <ProtectedRoute><AdminGate><Admin /></AdminGate></ProtectedRoute>
          </Route>

          <Route path="/admin/broadcast">
            <ProtectedRoute><AdminGate><Broadcast /></AdminGate></ProtectedRoute>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
      <Toaster />
      <SonnerToaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}

export default App;
