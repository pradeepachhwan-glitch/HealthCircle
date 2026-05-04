import { Switch, Route, Router as WouterRouter, Link, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import React, { useEffect, useRef } from "react";
import { AuthProvider, useAuth } from "@workspace/replit-auth-web";
import { useGetCurrentUser, setExtraHeadersGetter } from "@workspace/api-client-react";

// Forward the admin bypass token (stored in localStorage by the admin page)
// on every generated-client request as `x-admin-token`.
setExtraHeadersGetter(() => {
  if (typeof window === "undefined") return null;
  const t = window.localStorage.getItem("healthcircle:adminToken");
  return t ? { "x-admin-token": t } : null;
});


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
import LoadingOverlay from "@/components/LoadingOverlay";
import RouteChangeProgress from "@/components/RouteChangeProgress";
import CustomSignIn from "@/pages/sign-in";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import MedPro from "@/pages/medpro";
import TeleconsultDashboard from "@/pages/TeleconsultDashboard";
import TeleconsultTriage from "@/pages/TeleconsultTriage";
import TeleconsultDoctors from "@/pages/TeleconsultDoctors";
import TeleconsultSession from "@/pages/TeleconsultSession";
import TeleconsultSummary from "@/pages/TeleconsultSummary";
import DoctorApply from "@/pages/DoctorApply";
import AccountTypePage from "@/pages/account-type";
import HospitalDashboard from "@/pages/hospital-dashboard";
import Landing from "@/pages/landing/Landing";
import SolutionsPage from "@/pages/marketing/Solutions";
import ForDoctorsPage from "@/pages/marketing/ForDoctors";
import AboutPage from "@/pages/marketing/About";
import SupportPage from "@/pages/marketing/Support";

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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function SignInPage() {
  return <CustomSignIn />;
}

function HospitalRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user?.accountType !== "hospital" && user?.role !== "admin") {
    return <Redirect to="/communities" />;
  }
  return <>{children}</>;
}



function AdminGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useGetCurrentUser();
  const [bootstrapping, setBootstrapping] = React.useState(false);
  const [bootstrapStatus, setBootstrapStatus] = React.useState<{ adminExists: boolean } | null>(null);
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);

  const [showTokenForm, setShowTokenForm] = React.useState(false);
  const [tokenInput, setTokenInput] = React.useState("");
  const [tokenSubmitting, setTokenSubmitting] = React.useState(false);
  const [tokenError, setTokenError] = React.useState<string | null>(null);

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

  const handleTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = tokenInput.trim();
    if (!t) { setTokenError("Please paste the admin token."); return; }
    setTokenSubmitting(true);
    setTokenError(null);
    try {
      // Store the token first so setExtraHeadersGetter forwards it on the
      // probe call below. The backend's requireAdmin will (a) verify the
      // token in constant time and (b) auto-promote the signed-in Clerk
      // user's DB role to "admin" so the normal Clerk-based path works on
      // every subsequent request.
      window.localStorage.setItem("healthcircle:adminToken", t);
      const res = await fetch("/api/admin/stats", { headers: { "x-admin-token": t } });
      if (res.status === 401 || res.status === 403) {
        window.localStorage.removeItem("healthcircle:adminToken");
        setTokenError("That token is incorrect. Please double-check and try again.");
        return;
      }
      if (!res.ok) {
        setTokenError(`Unexpected response (${res.status}). Please try again.`);
        return;
      }
      // Token accepted + role promoted server-side → refetch the user so the
      // gate flips open.
      await refetch();
      setTokenInput("");
      setShowTokenForm(false);
    } catch {
      setTokenError("Network error. Please try again.");
    } finally {
      setTokenSubmitting(false);
    }
  };

  if (isLoading) return <LoadingOverlay variant="fixed" label="Checking your access…" />;

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

        {!showTokenForm ? (
          <button
            onClick={() => { setShowTokenForm(true); setTokenError(null); }}
            className="text-xs text-primary hover:underline mt-1"
            data-testid="open-admin-token-form"
          >
            Have a recovery admin token? Use it
          </button>
        ) : (
          <form onSubmit={handleTokenSubmit} className="mt-2 p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-sm w-full text-left">
            <p className="text-sm text-slate-700 font-medium mb-1">Recovery: enter admin token</p>
            <p className="text-xs text-slate-500 mb-3">
              Paste the server-side <code className="font-mono">ADMIN_TOKEN</code> to unlock and promote your account to admin.
              The token stays only in your browser.
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Paste admin token…"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono mb-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              data-testid="admin-token-input"
            />
            {tokenError && <p className="text-xs text-red-500 mb-2" data-testid="admin-token-error">{tokenError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={tokenSubmitting || !tokenInput.trim()}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
                data-testid="admin-token-submit"
              >
                {tokenSubmitting ? "Verifying…" : "Unlock & Promote"}
              </button>
              <button
                type="button"
                onClick={() => { setShowTokenForm(false); setTokenInput(""); setTokenError(null); }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
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
  if (isLoading) return <LoadingOverlay variant="fixed" label="Loading your workspace…" />;
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

function AuthQueryCacheInvalidator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      queryClient.clear();
    }
    prevUserIdRef.current = userId;
  }, [user, queryClient]);

  return null;
}

function HomeRedirect() {
  const { isLoading, isAuthenticated, user } = useAuth();
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (isAuthenticated) return <Redirect to={user?.accountType === "hospital" ? "/hospital" : "/communities"} />;
  return <Landing />;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [done, setDone] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (isLoading || !user) return;
    if (user.accountType === "hospital") {
      setDone(true);
      return;
    }
    const completed = localStorage.getItem(`onboarding_done_${user.clerkId}`);
    setDone(!!completed);
  }, [isLoading, user]);

  if (isLoading || !user || done === null) {
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
        userId={user.clerkId}
        onComplete={() => setDone(true)}
      />
    );
  }
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    // Send unauthenticated users to /sign-in (not back to /), and remember
    // where they were trying to go so we can return them post-login.
    const here = typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/";
    const next = encodeURIComponent(here);
    return <Redirect to={`/sign-in?next=${next}`} />;
  }
  return <OnboardingGate>{children}</OnboardingGate>;
}

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthQueryCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/account-type" component={AccountTypePage} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route path="/solutions" component={SolutionsPage} />
          <Route path="/for-doctors" component={ForDoctorsPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/support" component={SupportPage} />

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

          <Route path="/teleconsult">
            <ProtectedRoute><TeleconsultDashboard /></ProtectedRoute>
          </Route>

          <Route path="/teleconsult/triage">
            <ProtectedRoute><TeleconsultTriage /></ProtectedRoute>
          </Route>

          <Route path="/teleconsult/doctors">
            <ProtectedRoute><TeleconsultDoctors /></ProtectedRoute>
          </Route>

          <Route path="/teleconsult/session/:id">
            <ProtectedRoute><TeleconsultSession /></ProtectedRoute>
          </Route>

          <Route path="/teleconsult/summary/:id">
            <ProtectedRoute><TeleconsultSummary /></ProtectedRoute>
          </Route>

          <Route path="/become-a-doctor">
            <ProtectedRoute><DoctorApply /></ProtectedRoute>
          </Route>

          <Route path="/hospital">
            <ProtectedRoute><HospitalRoute><HospitalDashboard /></HospitalRoute></ProtectedRoute>
          </Route>

          <Route path="/admin">
            <ProtectedRoute><AdminGate><Admin /></AdminGate></ProtectedRoute>
          </Route>

          <Route path="/admin/broadcast">
            <ProtectedRoute><AdminGate><Broadcast /></AdminGate></ProtectedRoute>
          </Route>

          <Route component={NotFound} />
        </Switch>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <RouteChangeProgress />
        <AppRoutes />
      </WouterRouter>
      <Toaster />
      <SonnerToaster position="top-right" richColors closeButton />
    </TooltipProvider>
  );
}

export default App;
