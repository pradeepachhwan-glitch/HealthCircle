import { useState } from "react";
import { useSignIn, useAuth, useClerk } from "@clerk/react";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2, HeartPulse, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Stage = "credentials" | "verify_email";

async function lookupEmail(identifier: string): Promise<string> {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if (isEmail) return identifier;
  const res = await fetch(`${API_BASE}/auth/lookup?identifier=${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error("No account found with that username or mobile number.");
  const data = await res.json();
  return data.email;
}

type ClerkErrLike = { code?: string; message?: string; longMessage?: string };

function readClerkError(err: ClerkErrLike | null | undefined, fallback: string): string {
  if (!err) return fallback;
  const code = err.code;
  if (code === "form_identifier_not_found") {
    return "We couldn't find an account with that email/username. Please check it or create a new account.";
  }
  if (code === "form_password_incorrect") {
    return "That password is incorrect. Try again or reset it via Forgot password.";
  }
  if (code === "form_code_incorrect") {
    return "That code is incorrect. Please re-enter the 6-digit code we sent.";
  }
  if (code === "strategy_for_user_invalid") {
    return "This account doesn't have a password set up. Please use 'Forgot password?' to set one, or sign in with Google if you signed up with Google.";
  }
  return err.longMessage ?? err.message ?? fallback;
}

export default function SignInPage() {
  const { signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  const [stage, setStage] = useState<Stage>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifyTarget, setVerifyTarget] = useState("");
  const [emailFactorId, setEmailFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function finalizeAndGo(): Promise<boolean> {
    if (!signIn) return false;
    const { error: finErr } = await signIn.finalize({
      navigate: () => {
        window.location.assign(`${basePath}/communities`);
      },
    });
    if (finErr) {
      setError(readClerkError(finErr, "Sign-in succeeded but finishing the session failed. Please refresh and try again."));
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) {
      setError("Sign-in is not ready. Please refresh and try again.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (isSignedIn) {
        try { await signOut(); } catch { /* ignore */ }
      }
      const email = await lookupEmail(identifier.trim());

      // @clerk/react v6 signals API (SignInFutureResource):
      // Password is submitted via signIn.password() — NOT signIn.create().
      // create() only accepts OAuth/SAML/passkey/ticket strategies in this API.
      const { error: passErr } = await signIn.password({
        identifier: email,
        password,
      });
      if (passErr) {
        setError(readClerkError(passErr, "Sign-in failed. Please check your credentials."));
        return;
      }

      // After await, signIn signals (status, createdSessionId, supportedFirstFactors)
      // are updated. Branch on signIn.status.
      if (signIn.status === "complete" && signIn.createdSessionId) {
        await finalizeAndGo();
        return;
      }

      if (signIn.status === "needs_first_factor") {
        // Most common cause: "Verify email at sign-in" is enabled on this Clerk
        // instance, so even after a correct password Clerk wants email_code.
        const factors = signIn.supportedFirstFactors ?? [];
        const emailFactor = factors.find(
          (f): f is typeof f & { emailAddressId: string; safeIdentifier?: string } =>
            f.strategy === "email_code" && "emailAddressId" in f && !!f.emailAddressId
        );
        if (emailFactor) {
          const { error: sendErr } = await signIn.emailCode.sendCode({
            emailAddressId: emailFactor.emailAddressId,
          });
          if (sendErr) {
            setError(readClerkError(sendErr, "Could not send verification code."));
            return;
          }
          const target = emailFactor.safeIdentifier || email;
          setEmailFactorId(emailFactor.emailAddressId);
          setVerifyTarget(target);
          setStage("verify_email");
          setInfo(`We sent a 6-digit verification code to ${target}.`);
          return;
        }
        setError("This account needs an additional verification step that we don't support here. Please use 'Forgot password?' to reset and try again.");
        return;
      }

      if (signIn.status === "needs_second_factor") {
        setError("Two-factor authentication is enabled on this account. Please disable 2FA in your Clerk dashboard or use Clerk's hosted sign-in.");
        return;
      }

      if (signIn.status === "needs_new_password") {
        setError("Your password must be reset before you can sign in. Please use 'Forgot password?' below.");
        return;
      }

      setError(`Sign-in is in an unexpected state (${signIn.status}). Please try Forgot password.`);
    } catch (err: unknown) {
      const code = (err as { errors?: { code?: string }[] })?.errors?.[0]?.code;
      if (code === "session_exists") {
        window.location.assign(`${basePath}/communities`);
        return;
      }
      const clerkErr = (err as { errors?: ClerkErrLike[] })?.errors?.[0]
        ?? (err instanceof Error ? { message: err.message } : null);
      setError(readClerkError(clerkErr, "Sign-in failed. Please check your credentials."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) {
      setError("Sign-in is not ready. Please refresh and try again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: verifyErr } = await signIn.emailCode.verifyCode({ code: otp });
      if (verifyErr) {
        setError(readClerkError(verifyErr, "Verification failed."));
        return;
      }
      if (signIn.status === "complete" && signIn.createdSessionId) {
        await finalizeAndGo();
        return;
      }
      if (signIn.status === "needs_second_factor") {
        setError("Two-factor authentication is required for this account. Please disable 2FA in your Clerk dashboard or use Clerk's hosted sign-in.");
        return;
      }
      setError(`Verification accepted but sign-in did not complete (status: ${signIn.status}). Please try again.`);
    } catch (err: unknown) {
      const clerkErr = (err as { errors?: ClerkErrLike[] })?.errors?.[0]
        ?? (err instanceof Error ? { message: err.message } : null);
      setError(readClerkError(clerkErr, "Verification failed. Please try the code again."));
    } finally {
      setLoading(false);
    }
  }

  async function resendVerifyCode() {
    if (!signIn || !emailFactorId) return;
    setError(null);
    setInfo(null);
    try {
      const { error: sendErr } = await signIn.emailCode.sendCode({
        emailAddressId: emailFactorId,
      });
      if (sendErr) {
        setError(readClerkError(sendErr, "Could not resend the code."));
        return;
      }
      setInfo(`A new code has been sent to ${verifyTarget}.`);
    } catch (err: unknown) {
      const clerkErr = (err as { errors?: ClerkErrLike[] })?.errors?.[0]
        ?? (err instanceof Error ? { message: err.message } : null);
      setError(readClerkError(clerkErr, "Could not resend the code."));
    }
  }

  async function handleGoogle() {
    if (!signIn) return;
    setError(null);
    try {
      // @clerk/react v6: OAuth uses signIn.sso() instead of authenticateWithRedirect.
      const { error: ssoErr } = await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}${basePath}/sso-callback`,
        redirectCallbackUrl: `${window.location.origin}${basePath}/sso-callback`,
      });
      if (ssoErr) {
        setError(readClerkError(ssoErr, "Google sign-in could not be started. Please try again."));
      }
    } catch (err: unknown) {
      const clerkErr = (err as { errors?: ClerkErrLike[] })?.errors?.[0]
        ?? (err instanceof Error ? { message: err.message } : null);
      setError(readClerkError(clerkErr, "Google sign-in failed."));
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
          <h1 className="text-2xl font-bold text-slate-900">
            {stage === "credentials" ? "Welcome back" : "Verify your email"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {stage === "credentials"
              ? "Sign in to your HealthCircle account"
              : `Enter the 6-digit code we sent to ${verifyTarget}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          {stage === "credentials" ? (
            <>
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
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="signin-error">
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
            </>
          ) : (
            <form onSubmit={handleVerifyEmail} className="space-y-5">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
              </div>

              {info && !error && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{info}</div>
              )}

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">Verification Code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-12 text-center text-xl tracking-[0.5em] border-slate-200 focus-visible:ring-primary/30 font-mono"
                  autoFocus
                  required
                  data-testid="signin-otp-input"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="signin-error">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
                data-testid="signin-verify-button"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Verify & Sign In"}
              </Button>

              <button
                type="button"
                onClick={resendVerifyCode}
                className="w-full text-sm text-primary hover:underline font-medium"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setStage("credentials"); setOtp(""); setError(null); setInfo(null); }}
                className="w-full text-xs text-slate-500 hover:text-slate-700"
              >
                ← Back to sign-in
              </button>
            </form>
          )}
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
