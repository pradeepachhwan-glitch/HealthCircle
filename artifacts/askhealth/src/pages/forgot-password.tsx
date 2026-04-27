import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Loader2, HeartPulse, Mail, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Stage = "email" | "otp";

async function lookupEmail(identifier: string): Promise<string> {
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if (isEmail) return identifier;
  const res = await fetch(`${API_BASE}/auth/lookup?identifier=${encodeURIComponent(identifier)}`);
  if (!res.ok) throw new Error("No account found with that username or mobile number.");
  const data = await res.json();
  return data.email;
}

export default function ForgotPasswordPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [, setLocation] = useLocation();

  const [stage, setStage] = useState<Stage>("email");
  const [identifier, setIdentifier] = useState("");
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      const email = await lookupEmail(identifier.trim());
      setResolvedEmail(email);
      await signIn.create({ strategy: "reset_password_email_code", identifier: email });
      setStage("otp");
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : "Could not send reset code. Try again.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signIn) return;
    if (newPassword !== confirmPass) { setError("Passwords do not match."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: otp,
        password: newPassword,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLocation("/");
      } else {
        setError("Reset incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : "Password reset failed.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!isLoaded || !signIn || !resolvedEmail) return;
    setError(null);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: resolvedEmail });
    } catch {
      setError("Could not resend code.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center px-4 py-12">
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
            {stage === "email" ? "Forgot Password?" : "Reset Password"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {stage === "email"
              ? "Enter your email, username, or mobile — we'll send a reset code."
              : `Enter the code we sent to ${resolvedEmail}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          {stage === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">
                  Email, Username, or Mobile Number
                </Label>
                <Input
                  type="text"
                  placeholder="you@email.com or +91 9876543210"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <Button
                type="submit"
                disabled={loading || !identifier}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending code…</> : "Send Reset Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
              </div>

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
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <Button
                type="submit"
                disabled={loading || otp.length < 6 || !newPassword || !confirmPass}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Resetting…</> : "Set New Password"}
              </Button>

              <button
                type="button"
                onClick={resendOtp}
                className="w-full text-sm text-primary hover:underline font-medium"
              >
                Resend code
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
