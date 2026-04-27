import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2, HeartPulse, Mail, KeyRound, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Stage = "request" | "verify";
type Channel = "email" | "sms";

async function lookupEmail(identifier: string): Promise<string> {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if (isEmail) return identifier;
  const res = await fetch(`${API_BASE}/auth/lookup?identifier=${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error("No account found with that username or mobile number.");
  const data = await res.json();
  return data.email;
}

function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  // Indian default country code if a 10-digit number is supplied without +
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export default function ForgotPasswordPage() {
  const { signIn } = useSignIn();

  const [stage, setStage] = useState<Stage>("request");
  const [channel, setChannel] = useState<Channel>("email");
  const [identifier, setIdentifier] = useState("");
  const [resolvedTarget, setResolvedTarget] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function readClerkError(err: unknown, fallback: string): string {
    const clerkErr = (err as { errors?: { message: string; longMessage?: string; code?: string }[] })?.errors?.[0];
    const code = clerkErr?.code;
    if (code === "form_identifier_not_found") {
      return channel === "sms"
        ? "We couldn't find an account with that phone number. Try email instead, or check the number."
        : "We couldn't find an account with that email. Please check it or sign up.";
    }
    if (code === "strategy_for_user_invalid") {
      return channel === "sms"
        ? "SMS password reset isn't enabled for this account. Please use email instead."
        : "Email password reset isn't enabled for this account.";
    }
    if (code === "form_code_incorrect") {
      return "That code is incorrect. Please re-enter the 6-digit code we sent.";
    }
    return clerkErr?.longMessage ?? clerkErr?.message
      ?? (err instanceof Error ? err.message : fallback);
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) { setError("Reset is not ready. Please refresh and try again."); return; }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (channel === "sms") {
        const phone = normalizePhone(identifier);
        // @clerk/react v6 — phone reset. Identifier is set on the signIn attempt
        // first via create(), THEN sendCode() triggers Clerk's SMS. Requires
        // "Phone + SMS reset" enabled in the Clerk dashboard AND the user must
        // have a verified phone on their account.
        await signIn.create({ identifier: phone });
        await signIn.resetPasswordPhoneCode.sendCode();
        setResolvedTarget(phone);
        setInfo(`We sent a 6-digit reset code to ${phone}.`);
      } else {
        const email = await lookupEmail(identifier.trim());
        // @clerk/react v6 — email reset. Same two-step pattern: create() sets the
        // identifier, then sendCode() triggers the email. The old single-call
        // signIn.create({strategy: "reset_password_email_code"}) was a no-op in v6.
        await signIn.create({ identifier: email });
        await signIn.resetPasswordEmailCode.sendCode();
        setResolvedTarget(email);
        setInfo(`We sent a 6-digit reset code to ${email}. Check your inbox and spam folder.`);
      }
      setStage("verify");
    } catch (err: unknown) {
      setError(readClerkError(err, "Could not send the reset code. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) { setError("Reset is not ready. Please refresh and try again."); return; }
    if (newPassword !== confirmPass) { setError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    try {
      // @clerk/react v6 splits old attemptFirstFactor into two calls: verify the code,
      // then submit the new password.
      const flow = channel === "sms" ? signIn.resetPasswordPhoneCode : signIn.resetPasswordEmailCode;
      await flow.verifyCode({ code: otp });
      await flow.submitPassword({ password: newPassword });

      // Live getter — truthy when Clerk created the session for the (now reset) user.
      if (signIn.createdSessionId) {
        await signIn.finalize({
          navigate: () => {
            window.location.assign(`${basePath}/communities`);
          },
        });
        return;
      }
      // Edge case — code accepted, password set, but no session yet. Send to sign-in.
      setInfo("Password reset! Please sign in with your new password.");
      setTimeout(() => window.location.assign(`${basePath}/sign-in`), 1200);
    } catch (err: unknown) {
      setError(readClerkError(err, "Password reset failed."));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (!signIn || !resolvedTarget) return;
    setError(null);
    setInfo(null);
    try {
      // Re-create the signIn attempt to refresh the identifier, then resend.
      await signIn.create({ identifier: resolvedTarget });
      if (channel === "sms") {
        await signIn.resetPasswordPhoneCode.sendCode();
      } else {
        await signIn.resetPasswordEmailCode.sendCode();
      }
      setInfo(`A new code has been sent to ${resolvedTarget}.`);
    } catch (err: unknown) {
      setError(readClerkError(err, "Could not resend the code."));
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
            {stage === "request" ? "Forgot Password?" : "Reset Password"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {stage === "request"
              ? "Choose how you'd like to receive your reset code."
              : `Enter the 6-digit code we sent to ${resolvedTarget}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          {stage === "request" ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              {/* Channel toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setChannel("email"); setIdentifier(""); setError(null); }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    channel === "email" ? "bg-white shadow-sm text-primary" : "text-slate-600 hover:text-slate-900"
                  }`}
                  data-testid="reset-channel-email"
                >
                  <Mail className="w-4 h-4" />
                  Email me
                </button>
                <button
                  type="button"
                  onClick={() => { setChannel("sms"); setIdentifier(""); setError(null); }}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    channel === "sms" ? "bg-white shadow-sm text-primary" : "text-slate-600 hover:text-slate-900"
                  }`}
                  data-testid="reset-channel-sms"
                >
                  <Smartphone className="w-4 h-4" />
                  SMS me
                </button>
              </div>

              <div className="flex justify-center mb-1">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  {channel === "email" ? <Mail className="w-7 h-7 text-primary" /> : <Smartphone className="w-7 h-7 text-primary" />}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">
                  {channel === "email" ? "Email, Username, or Mobile Number" : "Mobile Number"}
                </Label>
                <Input
                  type={channel === "email" ? "text" : "tel"}
                  placeholder={channel === "email" ? "you@email.com or rahul123" : "+91 9876543210"}
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  required
                  autoFocus
                  data-testid="reset-identifier-input"
                />
                {channel === "sms" && (
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Use the same mobile number you signed up with. We'll add +91 automatically if you enter 10 digits.
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="reset-error">{error}</div>
              )}
              {info && !error && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">{info}</div>
              )}

              <Button
                type="submit"
                disabled={loading || !identifier}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
                data-testid="reset-send-button"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending code…</> : "Send Reset Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-primary" />
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
                  data-testid="reset-otp-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">New Password</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="h-11 border-slate-200 focus-visible:ring-primary/30 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">Confirm New Password</Label>
                <Input
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="reset-error">{error}</div>
              )}

              <Button
                type="submit"
                disabled={loading || otp.length < 6 || !newPassword || !confirmPass}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
                data-testid="reset-submit-button"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting…</> : "Set New Password"}
              </Button>

              <button
                type="button"
                onClick={resendCode}
                className="w-full text-sm text-primary hover:underline font-medium"
                data-testid="reset-resend-button"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setStage("request"); setOtp(""); setNewPassword(""); setConfirmPass(""); setError(null); setInfo(null); }}
                className="w-full text-xs text-slate-500 hover:text-slate-700"
              >
                ← Use a different email or number
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link href={`${basePath}/sign-in`} className="text-sm text-primary font-semibold hover:underline">
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
