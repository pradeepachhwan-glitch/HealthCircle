import { useState } from "react";
import { useSignIn, useAuth, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Loader2, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

async function lookupEmail(identifier: string): Promise<string> {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if (isEmail) return identifier;
  const res = await fetch(`${API_BASE}/auth/lookup?identifier=${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error("No account found with that username or mobile number.");
  const data = await res.json();
  return data.email;
}

export default function SignInPage() {
  const { signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToApp() {
    window.location.assign(`${basePath}/communities`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) {
      setError("Sign-in is not ready. Please refresh and try again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isSignedIn) {
        // Clear any stale session locally (no redirectUrl — that would reload the page).
        try { await signOut(); } catch { /* ignore */ }
      }
      const email = await lookupEmail(identifier.trim());
      await signIn.create({ identifier: email, password });
      // @clerk/react v6 (signals): signIn.status is hardcoded; check live getter createdSessionId.
      if (signIn.createdSessionId) {
        await signIn.finalize({
          navigate: () => {
            window.location.assign(`${basePath}/communities`);
          },
        });
        return;
      }
      setError(`Sign-in needs another step. If you signed up with Google, please use "Continue with Google", or use "Forgot password?" to set a password.`);
    } catch (err: unknown) {
      const clerkErr = (err as { errors?: { message: string; longMessage?: string; code?: string }[] })?.errors?.[0];
      const code = clerkErr?.code;
      let msg = clerkErr?.longMessage ?? clerkErr?.message
        ?? (err instanceof Error ? err.message : "Sign-in failed. Please check your credentials.");
      if (code === "form_identifier_not_found") {
        msg = "We couldn't find an account with that email/username. Please check it or create a new account.";
      } else if (code === "form_password_incorrect") {
        msg = "That password is incorrect. Try again or reset it via Forgot password.";
      } else if (code === "session_exists") {
        window.location.assign(`${basePath}/communities`);
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!signIn) return;
    setError(null);
    try {
      // @clerk/react v6: OAuth uses signIn.sso() instead of authenticateWithRedirect.
      await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${basePath}/sso-callback`,
        redirectCallbackUrl: `${window.location.origin}${basePath}/sso-callback`,
      });
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : "Google sign-in failed.");
      setError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">HealthCircle</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your HealthCircle account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          <Button
            type="button"
            onClick={handleGoogle}
            variant="outline"
            className="w-full h-11 border-slate-200 hover:bg-slate-50 font-medium text-sm flex items-center justify-center gap-2.5 mb-5"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40 36.6 44 30.8 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">or</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="identifier" className="text-slate-700 font-medium text-sm">
                Email, Username, or Mobile Number
              </Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="you@email.com or +91 9876543210"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                className="h-11 border-slate-200 focus-visible:ring-primary/30"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-700 font-medium text-sm">Password</Label>
                <Link href={`${basePath}/forgot-password`} className="text-xs text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-primary/30 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !identifier || !password}
              className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
            >
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</> : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Don't have an account?{" "}
              <Link href={`${basePath}/sign-up`} className="text-primary font-semibold hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in you agree to HealthCircle's{" "}
          <Link href={`${basePath}/terms`} className="text-primary hover:underline">Terms</Link>
          {" "}&amp;{" "}
          <Link href={`${basePath}/privacy`} className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
