import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import HealthCircleLogo from "@/components/HealthCircleLogo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Mode = "login" | "signup" | "forgot";
type Stage = "form" | "code" | "newPassword";

export default function SignInPage() {
  const {
    isLoading,
    isAuthenticated,
    login,
    signup,
    verifyEmail,
    resendVerification,
    requestPasswordReset,
    resetPassword,
  } = useAuth();
  const [, setLocation] = useLocation();

  // Capture an optional ?next=... so users sent to /sign-in from a
  // protected route (e.g. /admin) are returned to where they came from.
  // Only relative same-origin paths are honoured.
  const nextHref = (() => {
    if (typeof window === "undefined") return `${basePath}/`;
    const raw = new URLSearchParams(window.location.search).get("next");
    if (!raw) return `${basePath}/`;
    try {
      const decoded = decodeURIComponent(raw);
      // Reject anything that isn't a same-origin relative path.
      if (!decoded.startsWith("/") || decoded.startsWith("//")) return `${basePath}/`;
      return decoded;
    } catch {
      return `${basePath}/`;
    }
  })();
  function goNext() { setLocation(nextHref); }

  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<Stage>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeInputRef = useRef<HTMLInputElement | null>(null);

  // Already signed in → home.
  useEffect(() => {
    if (!isLoading && isAuthenticated) goNext();
  }, [isLoading, isAuthenticated, setLocation]);

  // Countdown for resend.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-focus the code input when we move to the verification stage.
  useEffect(() => {
    if (stage === "code") {
      const t = setTimeout(() => codeInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [stage]);

  function reset(toMode?: Mode) {
    setStage("form");
    setCode("");
    setNewPassword("");
    setError(null);
    setInfo(null);
    setBusy(false);
    if (toMode) setMode(toMode);
  }

  function switchMode(next: Mode) {
    reset(next);
    setPassword("");
    setDisplayName("");
  }

  // --- Login (email + password) ---------------------------------------------
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) {
      goNext();
      return;
    }
    if (res.needsVerification) {
      // Server already re-issued an OTP — switch to verification stage.
      setMode("signup");
      setStage("code");
      setInfo(res.error ?? "Please verify your email — we just sent a fresh code.");
      setCooldown(30);
      return;
    }
    setError(res.error ?? "That didn't work.");
  }

  // --- Signup (email + password → OTP) -------------------------------------
  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res = await signup(email, password, displayName.trim() || undefined);
    setBusy(false);
    if (res.ok) {
      setStage("code");
      setInfo(res.message ?? "Account created. Check your email for a 6-digit code.");
      setCooldown(30);
    } else {
      setError(res.error ?? "Could not create your account.");
      if (res.retryAfterSeconds) setCooldown(res.retryAfterSeconds);
    }
  }

  async function handleVerifySignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await verifyEmail(email, code);
    setBusy(false);
    if (res.ok) {
      goNext();
    } else {
      setError(res.error ?? "That code didn't work.");
      setCode("");
      setTimeout(() => codeInputRef.current?.focus(), 0);
    }
  }

  async function handleResendSignup() {
    if (cooldown > 0 || busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    // Use the dedicated re-send endpoint so we never overwrite the stored
    // password (the previous implementation called signup() again with a
    // placeholder password, which silently mutated the unverified row).
    const res = await resendVerification(email);
    setBusy(false);
    if (res.ok) {
      setInfo(res.message ?? "Sent a new code. Check your inbox.");
      setCooldown(30);
    } else {
      setError(res.error ?? "Could not resend code.");
      if (res.retryAfterSeconds) setCooldown(res.retryAfterSeconds);
    }
  }

  // --- Forgot password ------------------------------------------------------
  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    const res = await requestPasswordReset(email);
    setBusy(false);
    if (res.ok) {
      setStage("code");
      setInfo(res.message ?? "If that email is registered, we've sent a 6-digit code.");
      setCooldown(30);
    } else {
      setError(res.error ?? "Could not send reset code.");
      if (res.retryAfterSeconds) setCooldown(res.retryAfterSeconds);
    }
  }

  function gotoNewPassword(e: FormEvent) {
    e.preventDefault();
    if (code.length < 4) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);
    setStage("newPassword");
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res = await resetPassword(email, code, newPassword);
    setBusy(false);
    if (res.ok) {
      goNext();
    } else {
      setError(res.error ?? "Could not reset your password.");
    }
  }

  // --- Render helpers -------------------------------------------------------
  const titleByMode: Record<Mode, string> = {
    login: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
  };
  const subtitleByMode: Record<Mode, string> = {
    login: "Sign in to continue caring for your health.",
    signup: "Quick sign-up — we'll verify your email with a 6-digit code.",
    forgot: "We'll email you a 6-digit code to set a new password.",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/">
            <div className="inline-flex cursor-pointer mb-6">
              <HealthCircleLogo size="md" animate={true} />
            </div>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          {stage === "form" && mode !== "forgot" && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-5 text-sm">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`py-2 rounded-md font-medium transition-colors ${
                  mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
                data-testid="tab-login"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={`py-2 rounded-md font-medium transition-colors ${
                  mode === "signup" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
                data-testid="tab-signup"
              >
                Create account
              </button>
            </div>
          )}

          {stage !== "form" && (
            <button
              type="button"
              onClick={() => reset(mode)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3"
              data-testid="button-back"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          <h1 className="text-xl font-semibold text-slate-900">{titleByMode[mode]}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitleByMode[mode]}</p>

          {/* Google Sign-In: shown ONLY on the email/password form stage so
              we don't crowd the OTP / new-password screens. The button hides
              itself entirely if the server hasn't been configured with a
              Google client ID, so we always render it safely. After a
              successful Google sign-in we route to `nextHref` exactly the
              same way as a password sign-in. */}
          {stage === "form" && mode !== "forgot" && (
            <div className="mt-6">
              <GoogleSignInButton
                onError={(msg) => setError(msg)}
                onSuccess={() => goNext()}
              />
              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span>or continue with email</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>
          )}

          {/* ---- Stage: form ---- */}
          {stage === "form" && (
            <>
              {mode === "login" && (
                <form className="mt-6 space-y-4" onSubmit={handleLogin}>
                  <EmailField email={email} onChange={setEmail} />
                  <PasswordField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    show={showPwd}
                    onToggle={() => setShowPwd((s) => !s)}
                    autoComplete="current-password"
                  />
                  <div className="flex items-center justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-primary hover:underline"
                      data-testid="link-forgot"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <ErrorBlock error={error} />
                  <InfoBlock info={info} />
                  <PrimaryButton busy={busy} disabled={!email || !password} testId="button-login">
                    Sign in
                  </PrimaryButton>
                </form>
              )}

              {mode === "signup" && (
                <form className="mt-6 space-y-4" onSubmit={handleSignup}>
                  <EmailField email={email} onChange={setEmail} />
                  <Field
                    label="Your name (optional)"
                    icon={<User className="w-4 h-4 text-slate-400" />}
                    type="text"
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="What should we call you?"
                    testId="input-displayname"
                  />
                  <PasswordField
                    label="Create a password"
                    value={password}
                    onChange={setPassword}
                    show={showPwd}
                    onToggle={() => setShowPwd((s) => !s)}
                    autoComplete="new-password"
                    helper="At least 8 characters."
                  />
                  <ErrorBlock error={error} />
                  <InfoBlock info={info} />
                  <PrimaryButton busy={busy} disabled={!email || password.length < 8} testId="button-signup">
                    Create account
                  </PrimaryButton>
                </form>
              )}

              {mode === "forgot" && (
                <form className="mt-6 space-y-4" onSubmit={handleForgot}>
                  <EmailField email={email} onChange={setEmail} />
                  <ErrorBlock error={error} />
                  <InfoBlock info={info} />
                  <PrimaryButton busy={busy} disabled={!email} testId="button-forgot">
                    Send reset code
                  </PrimaryButton>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="w-full text-xs text-slate-500 hover:text-slate-700"
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          )}

          {/* ---- Stage: code (signup or forgot) ---- */}
          {stage === "code" && mode === "signup" && (
            <form className="mt-6 space-y-4" onSubmit={handleVerifySignup}>
              <p className="text-sm text-slate-500">
                We sent a 6-digit code to <span className="font-medium text-slate-800">{email}</span>.
              </p>
              <CodeField value={code} onChange={setCode} inputRef={codeInputRef} />
              <ErrorBlock error={error} />
              <InfoBlock info={info} />
              <PrimaryButton busy={busy} disabled={code.length < 4} testId="button-verify">
                Verify and sign in
              </PrimaryButton>
              <ResendButton cooldown={cooldown} busy={busy} onClick={handleResendSignup} />
            </form>
          )}

          {stage === "code" && mode === "forgot" && (
            <form className="mt-6 space-y-4" onSubmit={gotoNewPassword}>
              <p className="text-sm text-slate-500">
                If <span className="font-medium text-slate-800">{email}</span> has an account, we sent a 6-digit code.
              </p>
              <CodeField value={code} onChange={setCode} inputRef={codeInputRef} />
              <ErrorBlock error={error} />
              <InfoBlock info={info} />
              <PrimaryButton busy={false} disabled={code.length < 4} testId="button-code-next">
                Next
              </PrimaryButton>
            </form>
          )}

          {/* ---- Stage: newPassword (forgot) ---- */}
          {stage === "newPassword" && mode === "forgot" && (
            <form className="mt-6 space-y-4" onSubmit={handleResetPassword}>
              <p className="text-sm text-slate-500">Set a new password for {email}.</p>
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                show={showPwd}
                onToggle={() => setShowPwd((s) => !s)}
                autoComplete="new-password"
                helper="At least 8 characters."
              />
              <ErrorBlock error={error} />
              <PrimaryButton busy={busy} disabled={newPassword.length < 8} testId="button-reset">
                Save new password
              </PrimaryButton>
            </form>
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

// ---- Small reusable bits ---------------------------------------------------

function Field({
  label, icon, type = "text", value, onChange, placeholder, autoComplete, testId,
}: {
  label: string;
  icon?: React.ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>}
        <input
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${icon ? "pl-9" : "pl-3"} pr-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none`}
          data-testid={testId}
        />
      </div>
    </label>
  );
}

function EmailField({ email, onChange }: { email: string; onChange: (v: string) => void }) {
  return (
    <Field
      label="Email"
      icon={<Mail className="w-4 h-4 text-slate-400" />}
      type="email"
      autoComplete="email"
      value={email}
      onChange={onChange}
      placeholder="you@example.com"
      testId="input-email"
    />
  );
}

function PasswordField({
  label, value, onChange, show, onToggle, autoComplete, helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete?: string;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">{label}</span>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          data-testid="input-password"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
          aria-label={show ? "Hide password" : "Show password"}
          data-testid="button-toggle-password"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {helper && <span className="block text-xs text-slate-400 mt-1">{helper}</span>}
    </label>
  );
}

function CodeField({
  value, onChange, inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1.5">6-digit code</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        autoComplete="one-time-code"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        className="w-full px-3 py-3 text-center text-2xl tracking-[0.4em] font-semibold rounded-lg border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        data-testid="input-code"
      />
    </label>
  );
}

function PrimaryButton({
  children, busy, disabled, testId,
}: { children: React.ReactNode; busy: boolean; disabled: boolean; testId?: string }) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
      data-testid={testId}
    >
      {busy && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function ResendButton({ cooldown, busy, onClick }: { cooldown: number; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={cooldown > 0 || busy}
      className="w-full text-xs text-slate-500 hover:text-slate-700 disabled:opacity-60"
      data-testid="button-resend"
    >
      {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't get it? Resend code"}
    </button>
  );
}

function ErrorBlock({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-red-600" data-testid="text-error">{error}</p>;
}

function InfoBlock({ info }: { info: string | null }) {
  if (!info) return null;
  return <p className="text-sm text-emerald-600" data-testid="text-info">{info}</p>;
}
