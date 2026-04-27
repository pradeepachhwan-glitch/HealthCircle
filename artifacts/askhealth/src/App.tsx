import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import React, { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { useGetCurrentUser } from "@workspace/api-client-react";

import mindSpaceImg from "@/assets/community-mind-space.png";
import sugarCareImg from "@/assets/community-sugar-care.png";
import momJourneyImg from "@/assets/community-mom-journey.png";
import workResetImg from "@/assets/community-work-reset.png";
import fitLifeImg from "@/assets/community-fit-life.png";
import heartCircleImg from "@/assets/community-heart-circle.png";

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
import CustomSignIn from "@/pages/sign-in";
import CustomSignUp from "@/pages/sign-up";
import ForgotPassword from "@/pages/forgot-password";
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
  return <CustomSignIn />;
}

function SignUpPage() {
  return <CustomSignUp />;
}

const COMMUNITIES_PREVIEW = [
  { img: mindSpaceImg, name: "Mind Space", desc: "Talk, share, heal", tag: "Mental Wellness", slug: "mental-wellness", accent: "from-teal-50 to-cyan-50" },
  { img: sugarCareImg, name: "Sugar Care", desc: "Manage diabetes better", tag: "Diabetes", slug: "diabetes-care", accent: "from-rose-50 to-orange-50" },
  { img: momJourneyImg, name: "Mom Journey", desc: "Pregnancy to parenting", tag: "Motherhood", slug: "pregnancy-motherhood", accent: "from-pink-50 to-purple-50" },
  { img: workResetImg, name: "Work Reset", desc: "Beat stress & burnout", tag: "Work Wellness", slug: "work-stress-burnout", accent: "from-blue-50 to-sky-50" },
  { img: fitLifeImg, name: "Fit Life", desc: "Fitness your way", tag: "Fitness", slug: "weight-loss-fitness", accent: "from-green-50 to-emerald-50" },
  { img: heartCircleImg, name: "Heart Circle", desc: "Care for your heart", tag: "Cardiology", slug: "heart-health", accent: "from-red-50 to-rose-50" },
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
    <div className="min-h-[100dvh] flex flex-col bg-white font-sans">
      {/* Sticky Header */}
      <header className="px-4 md:px-8 py-4 flex items-center justify-between bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20 shadow-sm">
        <button onClick={() => scrollTo("hero")} className="cursor-pointer">
          <HealthCircleLogo size="sm" animate={false} />
        </button>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          {[["solutions","Solutions"],["for-doctors","For Doctors"],["about","About"],["support","Support"]].map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="hover:text-primary transition-colors duration-200 relative group">
              {label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-primary rounded-full transition-all duration-200 group-hover:w-full" />
            </button>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/sign-in" className="text-sm font-medium px-5 py-2.5 text-slate-600 hover:text-primary transition-colors duration-200 rounded-xl hover:bg-slate-50">Sign In</Link>
          <Link href="/sign-up" className="text-sm font-semibold px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-px">Get Started Free</Link>
        </div>
        <button onClick={() => setMobileMenuOpen(v => !v)} className="md:hidden p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>
      </header>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-[65px] left-0 right-0 z-10 bg-white border-b border-slate-100 shadow-xl rounded-b-2xl p-5 space-y-1">
          {[["solutions","Solutions"],["for-doctors","For Doctors"],["about","About"],["support","Support"]].map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-primary transition-all duration-200">
              {label}
            </button>
          ))}
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <Link href="/sign-in" className="flex-1 text-center text-sm font-medium px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">Sign In</Link>
            <Link href="/sign-up" className="flex-1 text-center text-sm font-semibold px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">Get Started</Link>
          </div>
        </div>
      )}

      <main className="flex-1">
        {/* ── HERO ── */}
        <section id="hero" className="relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/40 to-white">
          <div className="max-w-4xl mx-auto text-center px-4 pt-24 pb-20 md:pt-32 md:pb-28">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8 border border-primary/20">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              AI Health Guidance • Multi-language • India-first
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight mb-6 leading-[1.1]">
              Ask. Share. Learn.<br />
              <span className="text-primary">Act on your health.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
              Join trusted health communities, get AI-backed clarity, and take confident next steps — without confusion.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/sign-up" className="px-8 py-3.5 bg-primary text-white rounded-xl font-semibold text-base hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5">
                Join a Community
              </Link>
              <Link href="/sign-up" className="px-8 py-3.5 bg-white text-slate-800 rounded-xl font-semibold text-base border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5">
                Ask a Question
              </Link>
            </div>
            <p className="text-xs text-slate-400 mt-5">Free forever. No credit card needed.</p>
          </div>
        </section>

        {/* ── COMMUNITIES GRID ── */}
        <section className="max-w-6xl mx-auto px-4 py-20 md:py-24">
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900">Explore Communities that Understand You</h2>
            <p className="text-slate-500 mt-2 text-base">Real people. Real experiences. Backed by AI clarity.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {COMMUNITIES_PREVIEW.map(c => (
              <Link key={c.slug} href="/sign-up">
                <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer">
                  <div className={`bg-gradient-to-br ${c.accent} h-32 flex items-center justify-center overflow-hidden`}>
                    <img src={c.img} alt={c.name} className="h-24 w-24 object-contain group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="p-5">
                    <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full mb-2">{c.tag}</span>
                    <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-primary transition-colors">{c.name}</h3>
                    <p className="text-sm text-slate-500">{c.desc}</p>
                    <span className="inline-block mt-3 text-xs font-semibold text-primary group-hover:gap-2 transition-all">Join →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/sign-up" className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline underline-offset-2 transition-all">
              See all 20 communities →
            </Link>
          </div>
        </section>

        {/* ── TRENDING QUESTIONS ── */}
        <section className="bg-slate-50 border-y border-slate-100 py-20 md:py-24 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">What people are asking right now</h2>
            <p className="text-slate-500 mb-8">Real questions — answered by the community and Yukti AI.</p>
            <div className="space-y-3">
              {TRENDING_QUESTIONS.map((item, i) => (
                <Link key={i} href="/sign-up">
                  <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 group">
                    <div>
                      <p className="text-slate-900 font-semibold text-sm group-hover:text-primary transition-colors">{item.q}</p>
                      <p className="text-xs text-slate-400 mt-1.5">{item.community}</p>
                    </div>
                    <div className="shrink-0 text-xs bg-slate-100 text-slate-500 font-medium px-2.5 py-1 rounded-full">{item.replies} replies</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="max-w-5xl mx-auto px-4 py-20 md:py-24">
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 text-center mb-14">How it works</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((item, idx) => (
              <div key={item.step} className="text-center group">
                <div className="relative w-14 h-14 rounded-2xl bg-primary/10 text-primary font-bold text-xl flex items-center justify-center mx-auto mb-5 shadow-sm group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  {item.step}
                  {idx < HOW_IT_WORKS.length - 1 && (
                    <div className="hidden md:block absolute left-full top-1/2 w-full h-px bg-slate-200 -translate-y-1/2 ml-4" />
                  )}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[180px] mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SOLUTIONS ── */}
        <section id="solutions" className="bg-slate-50 border-y border-slate-100 py-20 md:py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">Everything you need for smarter healthcare</h2>
              <p className="text-slate-500 max-w-lg mx-auto">AI, community wisdom, and professional expertise — in one seamless platform.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: "🤖", title: "Yukti AI Assistant", desc: "Instant, evidence-based answers. Yukti understands symptoms, flags risk levels, and guides next steps — in English and Hindi." },
                { icon: "👥", title: "Health Communities", desc: "20+ specialised communities — diabetes, heart, mental wellness, pregnancy. Share with people who truly understand." },
                { icon: "🩺", title: "Doctor Network", desc: "Find verified doctors and book appointments. View availability, fees, and specialties — all from one place." },
                { icon: "🏆", title: "Gamified Journey", desc: "Earn Health Credits, level up, earn badges, and climb leaderboards while improving your health knowledge." },
                { icon: "🔒", title: "Privacy-First", desc: "Your health data stays private. Enterprise-grade security. We never sell your information." },
                { icon: "🌐", title: "Multi-language", desc: "English and Hindi today, more languages coming — because healthcare guidance should reach everyone." },
              ].map(s => (
                <div key={s.title} className="group bg-white rounded-2xl p-7 border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                  <div className="text-3xl mb-5 w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">{s.icon}</div>
                  <h3 className="font-semibold text-slate-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOR DOCTORS ── */}
        <section id="for-doctors" className="py-20 md:py-28 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">🩺 For Medical Professionals</div>
                <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-4 leading-tight">A dedicated portal built for healthcare providers</h2>
                <p className="text-slate-500 mb-7 leading-relaxed max-w-md">HealthCircle's MedPro Portal gives doctors a powerful workspace to review urgent cases, respond to patients, and validate AI summaries.</p>
                <ul className="space-y-3.5">
                  {[
                    "Urgent case alerts — high-risk AI flags delivered directly",
                    "Patient consultation requests with clinical note responses",
                    "AI Summary validation — review and approve health summaries",
                    "Community moderation across health communities",
                    "Verified professional badge to build community trust",
                  ].map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="flex-shrink-0 w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-9">
                  <Link href="/sign-up" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5">
                    Join as a Medical Professional →
                  </Link>
                </div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-100 shadow-sm">
                <div className="space-y-4">
                  {[
                    { label: "Urgent Cases", value: "Real-time alerts for high-risk patients", icon: "🚨" },
                    { label: "Patient Requests", value: "Direct consultation messaging", icon: "👤" },
                    { label: "AI Validation", value: "Quality control on summaries", icon: "🤖" },
                    { label: "Expert Responses", value: "Measurable community impact", icon: "💬" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm hover:shadow-md transition-all duration-200">
                      <div className="text-2xl w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">{item.icon}</div>
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{item.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section id="about" className="bg-slate-900 text-white py-20 md:py-28 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-start">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold mb-5">About HealthCircle</h2>
                <p className="text-slate-300 leading-relaxed mb-4 max-w-md">
                  HealthCircle is India's first AI-powered healthcare super app — built for real people navigating real challenges. We combine community wisdom, AI clarity, and professional expertise.
                </p>
                <p className="text-slate-400 leading-relaxed mb-8 max-w-md">
                  Founded on the belief that quality healthcare guidance should be accessible to every Indian — in their language, on their schedule.
                </p>
                <div className="grid grid-cols-3 gap-5">
                  {[["20+", "Communities"], ["Yukti AI", "Health Assistant"], ["2 Languages", "English & Hindi"]].map(([val, lbl]) => (
                    <div key={lbl} className="bg-slate-800 rounded-2xl p-4 border border-slate-700 text-center">
                      <div className="text-lg font-bold text-primary mb-1">{val}</div>
                      <div className="text-xs text-slate-400 leading-snug">{lbl}</div>
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
                  <div key={v.title} className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700 hover:border-slate-600 hover:bg-slate-800 transition-all duration-200">
                    <div className="text-2xl mb-3">{v.icon}</div>
                    <div className="font-semibold text-white mb-1.5">{v.title}</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{v.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SUPPORT / FAQ ── */}
        <section id="support" className="py-20 md:py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-3">We're here to help</h2>
              <p className="text-slate-500 max-w-sm mx-auto">Reach out anytime — we respond within 24 hours.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5 mb-14">
              {/* EMAIL SUPPORT */}
              <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
                  <svg viewBox="0 0 24 24" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" fill="#EA4335"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Email Support</h3>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed">General inquiries, account help, or technical issues. We reply within 24 hours.</p>
                <a
                  href={`mailto:yukticare.support@gmail.com?subject=${encodeURIComponent("Support Request – HealthCircle")}&body=${encodeURIComponent("Hi HealthCircle Team,\n\nName: \nEmail: \nQuery:\n\n[Describe your issue or question here]\n\nThank you")}`}
                  className="inline-flex items-center gap-1.5 text-sm text-red-600 font-semibold hover:underline underline-offset-2 transition-colors"
                >
                  yukticare.support@gmail.com
                </a>
              </div>

              {/* WHATSAPP / PARTNERSHIPS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-5">
                  <svg viewBox="0 0 24 24" className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">WhatsApp & Partnerships</h3>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed">Chat with us on WhatsApp — hospitals, clinics, health brands or anyone with a question.</p>
                <a
                  href={`https://wa.me/919278347143?text=${encodeURIComponent("Hi HealthCircle Team! 👋 I'm interested in partnering with HealthCircle.\n\nOrganization/Name: \nEmail: \nPartnership Interest:\n\n[Tell us more about your interest]")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-green-600 font-semibold hover:underline underline-offset-2 transition-colors"
                >
                  +91 92783 47143
                </a>
              </div>

              {/* DOCTOR ONBOARDING */}
              <div className="bg-white border border-slate-200 rounded-2xl p-7 text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5 text-3xl">🩺</div>
                <h3 className="font-semibold text-slate-900 mb-2">Doctor Onboarding</h3>
                <p className="text-sm text-slate-500 mb-5 leading-relaxed">Join as a verified medical professional and help thousands of patients across India.</p>
                <div className="flex flex-col items-center gap-2">
                  <Link href="/sign-up" className="text-sm text-primary font-semibold hover:underline underline-offset-2 transition-colors">
                    Create an account →
                  </Link>
                  <a
                    href={`https://wa.me/919278347143?text=${encodeURIComponent("Hi HealthCircle Team! 👋 I'm a medical professional interested in joining the MedPro portal.\n\nName: \nSpecialization: \nRegistration No.: \nEmail: ")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium hover:underline"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
                    Or WhatsApp us to get verified
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-8">
              <h3 className="font-semibold text-slate-900 mb-1 text-center text-lg">Frequently Asked Questions</h3>
              <p className="text-slate-500 text-sm text-center mb-7">Everything you need to know</p>
              <div className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                {[
                  ["Is HealthCircle free?", "Yes — completely free. No credit card required."],
                  ["Is the AI a replacement for doctors?", "No. Yukti AI provides guidance but always recommends a doctor for serious concerns."],
                  ["Is my health data private?", "Absolutely. Encrypted and never sold to third parties."],
                  ["Can I ask questions in Hindi?", "Yes, Yukti AI responds in English and Hindi."],
                  ["How do I become a verified doctor?", "Create an account, then contact us at yukticare.support@gmail.com or WhatsApp +91 92783 47143 to get verified."],
                  ["How quickly do doctors respond?", "Most Medical Professionals respond within 24-48 hours."],
                ].map(([q, a]) => (
                  <div key={q} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="font-semibold text-slate-900 text-sm mb-1.5">{q}</div>
                    <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="relative overflow-hidden bg-primary py-20 md:py-24 px-4">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
          <div className="max-w-2xl mx-auto text-center relative">
            <div className="inline-flex w-12 h-12 bg-white/20 rounded-2xl items-center justify-center text-2xl mb-6 mx-auto">🔒</div>
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">Your health data stays private.</h2>
            <p className="text-primary-foreground/75 text-base mb-2 max-w-md mx-auto leading-relaxed">
              AI guidance is safe, structured, and never a replacement for real doctors.
            </p>
            <p className="text-primary-foreground/50 text-sm mb-10">Free to join • No credit card • English & Hindi</p>
            <Link href="/sign-up" className="inline-block px-8 py-4 bg-white text-primary rounded-xl font-semibold text-base hover:bg-white/95 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Get Started — It's Free
            </Link>
          </div>
        </section>

        {/* ── FLOATING WHATSAPP BUTTON ── */}
        <a
          href={`https://wa.me/919278347143?text=${encodeURIComponent("Hi HealthCircle Team! 👋 I have a question:\n\n")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#25D366] text-white px-4 py-3 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:bg-[#22c55e] transition-all duration-200 group"
          title="Chat on WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
          </svg>
          <span className="text-sm font-semibold leading-none">Chat with us</span>
        </a>

        {/* ── FOOTER ── */}
        <footer className="bg-slate-50 border-t border-slate-100 py-10 px-4">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
            <HealthCircleLogo size="sm" animate={false} />
            <div className="flex flex-wrap gap-5 text-sm text-slate-500">
              {[["about","About"],["solutions","Solutions"],["for-doctors","For Doctors"],["support","Support"]].map(([id,label]) => (
                <button key={id} onClick={() => scrollTo(id)} className="hover:text-primary transition-colors duration-200">{label}</button>
              ))}
              <a href={`mailto:yukticare.support@gmail.com?subject=${encodeURIComponent("HealthCircle Enquiry")}&body=${encodeURIComponent("Hi HealthCircle Team,\n\nName: \nEmail: \nQuery:\n\nThank you")}`} className="hover:text-primary transition-colors duration-200">Contact</a>
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

  if (!isLoaded || !user || done === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Preparing your space…</p>
        </div>
      </div>
    );
  }
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
          <Route path="/forgot-password" component={ForgotPassword} />

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
