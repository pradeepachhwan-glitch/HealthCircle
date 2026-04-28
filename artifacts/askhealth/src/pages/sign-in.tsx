import { useEffect } from "react";
import { Link } from "wouter";
import { HeartPulse } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignInPage() {
  const { login, isLoading, isAuthenticated } = useAuth();

  // Replit Auth flow: this page exists only to host the legacy /sign-in URL.
  // If the user is already signed in we send them home; otherwise we kick off
  // the OIDC flow immediately so signing in is one tap from any entry point.
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      window.location.replace(basePath || "/");
      return;
    }
    login();
  }, [isLoading, isAuthenticated, login]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <Link href="/">
          <div className="inline-flex items-center gap-2.5 cursor-pointer mb-6">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">HealthCircle</span>
          </div>
        </Link>

        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Taking you to a secure sign-in…</p>
        </div>

        <button
          type="button"
          onClick={() => login()}
          className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 text-sm"
          data-testid="button-sign-in"
        >
          Continue to sign in
        </button>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in you agree to HealthCircle's{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms</Link>
          {" "}&amp;{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
