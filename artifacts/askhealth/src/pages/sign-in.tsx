import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, HeartPulse, Loader2, Mail } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Step = "email" | "code";

export default function SignInPage() {
  const { isLoading, isAuthenticated, requestOtp, verifyOtp } = useAuth();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // If a signed-in user lands on /sign-in, send them home.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  // Cooldown countdown for resend button.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-focus the code input when we move to step 2.
  useEffect(() => {
    if (step === "code") {
      const t = setTimeout(() => codeInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [step]);

  async function handleSendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await requestOtp(email);
    setBusy(false);
    if (res.ok) {
      setStep("code");
      setInfo(res.message ?? "We just emailed you a 6-digit code.");
      setCooldown(30);
    } else {
      setError(res.error ?? "Could not send code right now.");
      if (res.retryAfterSeconds) setCooldown(res.retryAfterSeconds);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await requestOtp(email);
    setBusy(false);
    if (res.ok) {
      setInfo(res.message ?? "Sent again. Check your inbox.");
      setCooldown(30);
    } else {
      setError(res.error ?? "Could not resend code.");
      if (res.retryAfterSeconds) setCooldown(res.retryAfterSeconds);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await verifyOtp(email, code);
    setBusy(false);
    if (res.ok) {
      setLocation(`${basePath}/`);
    } else {
      setError(res.error ?? "That code didn't work.");
      setCode("");
      setTimeout(() => codeInputRef.current?.focus(), 0);
    }
  }

  function backToEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setInfo(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">HealthCircle</span>
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          {step === "email" ? (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Sign in or create account</h1>
              <p className="mt-1 text-sm text-slate-500">
                Enter your email and we'll send you a 6-digit code. No passwords.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSendCode}>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">Email</span>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoFocus
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      data-testid="input-email"
                    />
                  </div>
                </label>

                {error && (
                  <p className="text-sm text-red-600" data-testid="text-error">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  data-testid="button-send-code"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {busy ? "Sending code…" : "Send me a code"}
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToEmail}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3"
                data-testid="button-back"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Use a different email
              </button>
              <h1 className="text-xl font-semibold text-slate-900">Enter your code</h1>
              <p className="mt-1 text-sm text-slate-500">
                We sent a 6-digit code to <span className="font-medium text-slate-800">{email}</span>.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleVerify}>
                <label className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-1.5">6-digit code</span>
                  <input
                    ref={codeInputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-3 py-3 text-center text-2xl tracking-[0.4em] font-semibold rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    data-testid="input-code"
                  />
                </label>

                {info && !error && (
                  <p className="text-sm text-emerald-600" data-testid="text-info">{info}</p>
                )}
                {error && (
                  <p className="text-sm text-red-600" data-testid="text-error">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={busy || code.length < 4}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                  data-testid="button-verify"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {busy ? "Verifying…" : "Verify and sign in"}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || busy}
                  className="w-full text-xs text-slate-500 hover:text-slate-700 disabled:opacity-60"
                  data-testid="button-resend"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By continuing you agree to HealthCircle's{" "}
          <Link href="/terms" className="text-primary hover:underline">Terms</Link>
          {" "}&amp;{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
