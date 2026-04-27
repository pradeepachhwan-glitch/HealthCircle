import { useState } from "react";
import { useSignUp } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff, Loader2, HeartPulse, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Stage = "details" | "verify";

export default function SignUpPage() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const [, setLocation] = useLocation();

  const [stage, setStage] = useState<Stage>("details");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    if (password !== confirmPass) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    try {
      await signUp.create({
        firstName: fullName.split(" ")[0],
        lastName: fullName.split(" ").slice(1).join(" ") || undefined,
        emailAddress: email.trim().toLowerCase(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStage("verify");
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : "Registration failed. Please try again.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: otp });
      if (result.status === "complete") {
        // Store username + mobile in our DB after Clerk session is created
        await setActive({ session: result.createdSessionId });
        try {
          await fetch(`${API_BASE}/users/me`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              displayName: fullName,
              username: username.trim() || null,
              mobileNumber: mobile.trim() || null,
            }),
          });
        } catch {
          // Non-fatal — user data still created via getOrCreateUser on next request
        }
        setLocation("/");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: unknown) {
      const msg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message
        ?? (err instanceof Error ? err.message : "Verification failed.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (!isLoaded || !signUp) return;
    setError(null);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch {
      setError("Could not resend code. Please try again.");
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
            {stage === "details" ? "Create your account" : "Verify your email"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {stage === "details"
              ? "Join HealthCircle — India's health community"
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8">
          {stage === "details" ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">Full Name</Label>
                <Input
                  type="text"
                  placeholder="Rahul Sharma"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium text-sm">Username</Label>
                  <Input
                    type="text"
                    placeholder="rahul123"
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-700 font-medium text-sm">Mobile Number</Label>
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">Email Address <span className="text-red-500">*</span></Label>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-11 border-slate-200 focus-visible:ring-primary/30"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-medium text-sm">Password <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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
                <Label className="text-slate-700 font-medium text-sm">Confirm Password <span className="text-red-500">*</span></Label>
                <Input
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
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
                disabled={loading || !fullName || !email || !password || !confirmPass}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating account…</> : "Create Account"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="flex justify-center mb-2">
                <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-primary" />
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

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <Button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Verify & Continue"}
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
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link href={`${basePath}/sign-in`} className="text-primary font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By creating an account you agree to HealthCircle's Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
}
