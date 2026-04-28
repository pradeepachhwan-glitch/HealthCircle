import { SignUp } from "@clerk/react";
import { Link } from "wouter";
import { HeartPulse } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/">
            <div className="inline-flex items-center gap-2.5 cursor-pointer mb-4">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-md">
                <HeartPulse className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">HealthCircle</span>
            </div>
          </Link>
        </div>

        <div className="flex justify-center" data-testid="clerk-signup-mount">
          <SignUp
            path={`${basePath}/sign-up`}
            routing="path"
            signInUrl={`${basePath}/sign-in`}
            forceRedirectUrl={`${basePath}/communities`}
            fallbackRedirectUrl={`${basePath}/communities`}
          />
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          By creating an account you agree to HealthCircle's{" "}
          <Link href={`${basePath}/terms`} className="text-primary hover:underline">Terms</Link>
          {" "}&amp;{" "}
          <Link href={`${basePath}/privacy`} className="text-primary hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
