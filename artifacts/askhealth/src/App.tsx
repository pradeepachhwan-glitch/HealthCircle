import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

const queryClient = new QueryClient();

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
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-white/80 backdrop-blur border-b sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">AH</div>
          <span className="font-bold text-lg text-slate-900">AskHealth AI</span>
        </div>
        <div className="flex gap-3">
          <Link href="/sign-in" className="text-sm font-medium px-4 py-2 hover:text-primary transition-colors text-slate-600">Sign In</Link>
          <Link href="/sign-up" className="text-sm font-medium px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">Get Started Free</Link>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO — Community-first */}
        <section className="max-w-4xl mx-auto text-center px-4 pt-16 pb-14">
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

        {/* TRUST BLOCK */}
        <section className="bg-slate-900 text-white py-14 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-3xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold mb-3">Your health data is private.</h2>
            <p className="text-slate-300 text-base mb-2">
              AI guidance is safe, structured, and not a replacement for doctors.
            </p>
            <p className="text-slate-400 text-sm mb-8">
              Free to join. No credit card needed. Available in English & Hindi.
            </p>
            <Link href="/sign-up" className="inline-block px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all">
              Get Started — It's Free
            </Link>
          </div>
        </section>
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        {children}
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
    </TooltipProvider>
  );
}

export default App;
