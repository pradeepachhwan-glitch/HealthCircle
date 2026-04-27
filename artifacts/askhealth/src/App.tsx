import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useRef } from "react";
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

const FEATURES = [
  { icon: "💬", title: "AI Health Chat", desc: "WhatsApp-style chat with Yukti, your AI health assistant" },
  { icon: "🔍", title: "Smart Search", desc: "Intent-aware search for symptoms, treatments, and doctors" },
  { icon: "👨‍⚕️", title: "Find Doctors", desc: "Browse specialists and book appointments instantly" },
  { icon: "🏥", title: "Hospital Network", desc: "Access top hospitals across India with ratings & specialties" },
  { icon: "🏆", title: "Community", desc: "Clinical communities for healthcare professionals" },
  { icon: "🔒", title: "Private & Secure", desc: "Your health data stays private and encrypted" },
];

function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-slate-50 to-white">
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
        <section className="max-w-4xl mx-auto text-center px-4 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            AI Health Guidance • Multi-language • India-first
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6 leading-tight">
            Your Personal<br /><span className="text-primary">Health Super App</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Chat with Yukti AI about your symptoms, find trusted doctors, book appointments, and connect with healthcare professionals — all in one place.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/sign-up" className="px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all shadow-md hover:shadow-lg">
              Start Chatting Free →
            </Link>
            <Link href="/sign-in" className="px-8 py-4 bg-white text-slate-900 rounded-xl font-semibold text-lg border border-slate-200 hover:bg-slate-50 transition-all">
              Sign In
            </Link>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 text-white py-16 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Join thousands of users getting better healthcare</h2>
            <p className="text-slate-400 mb-8">Free to start. No credit card required. Available in English & Hindi.</p>
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
  const { data: user, isLoading } = useGetCurrentUser();
  if (isLoading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>;
  if (user?.role !== "admin") return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <div className="text-6xl">🚫</div>
      <h2 className="text-xl font-bold text-slate-700">Access Denied</h2>
      <p className="text-slate-500">You need admin privileges to access this page.</p>
      <Link href="/chat"><button className="px-4 py-2 bg-primary text-white rounded-lg text-sm">Go to Chat</button></Link>
    </div>
  );
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
        <Redirect to="/chat" />
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
