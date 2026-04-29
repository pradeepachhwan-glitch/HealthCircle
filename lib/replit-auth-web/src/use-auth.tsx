import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type UserRole = "admin" | "moderator" | "medical_professional" | "member";

export interface AuthUser {
  id: number;
  clerkId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isBanned: boolean;
  username?: string | null;
  mobileNumber?: string | null;
  healthCredits?: number;
  level?: number;
  emailVerifiedAt?: string | Date | null;
}

export interface ApiResult {
  ok: boolean;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
  needsVerification?: boolean;
}

export interface ApiUserResult extends ApiResult {
  user?: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Password-based flows
  signup: (email: string, password: string, displayName?: string) => Promise<ApiResult>;
  verifyEmail: (email: string, code: string) => Promise<ApiUserResult>;
  resendVerification: (email: string) => Promise<ApiResult>;
  login: (email: string, password: string) => Promise<ApiUserResult>;
  requestPasswordReset: (email: string) => Promise<ApiResult>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<ApiUserResult>;

  // Optional passwordless ("magic code") flow
  requestOtp: (email: string) => Promise<ApiResult>;
  verifyOtp: (email: string, code: string) => Promise<ApiUserResult>;

  // Google Sign-In: pass the JWT credential string returned by Google
  // Identity Services to the backend for verification + session creation.
  loginWithGoogle: (credential: string) => Promise<ApiUserResult>;

  logout: () => Promise<void>;
  refresh: () => Promise<void>;

  // Clerk-compatible aliases — let migrated pages keep destructuring patterns.
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface RawResponse {
  success?: boolean;
  message?: string;
  error?: string;
  user?: AuthUser;
  retryAfterSeconds?: number;
  needsVerification?: boolean;
}

async function postJson(url: string, body: unknown): Promise<{ status: number; json: RawResponse | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let json: RawResponse | null = null;
    try {
      json = (await res.json()) as RawResponse;
    } catch {
      json = null;
    }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  }
}

function toResult(status: number, json: RawResponse | null, fallbackError: string): ApiResult {
  if (status === 0 && !json) return { ok: false, error: "Network error. Please check your connection and try again." };
  if (status >= 200 && status < 300 && json?.success) {
    return { ok: true, message: json.message };
  }
  return {
    ok: false,
    error: json?.error ?? fallbackError,
    retryAfterSeconds: json?.retryAfterSeconds,
    needsVerification: json?.needsVerification,
  };
}

function toUserResult(status: number, json: RawResponse | null, fallbackError: string): ApiUserResult {
  const base = toResult(status, json, fallbackError);
  if (base.ok && json?.user) return { ...base, user: json.user };
  return base;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---- Password flow -----------------------------------------------------

  const signup = useCallback(async (email: string, password: string, displayName?: string) => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, error: "Please enter your email address." } as ApiResult;
    const { status, json } = await postJson("/api/auth/signup", { email: trimmed, password, displayName });
    return toResult(status, json, "Could not create your account right now.");
  }, []);

  const verifyEmail = useCallback(async (email: string, code: string) => {
    const { status, json } = await postJson("/api/auth/verify-email", { email: email.trim(), code: code.trim() });
    const result = toUserResult(status, json, "That code didn't work.");
    if (result.ok && result.user) setUser(result.user);
    return result;
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const { status, json } = await postJson("/api/auth/resend-verification", { email: email.trim() });
    return toResult(status, json, "Could not resend code right now.");
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { status, json } = await postJson("/api/auth/login", { email: email.trim(), password });
    const result = toUserResult(status, json, "That email or password didn't match.");
    if (result.ok && result.user) setUser(result.user);
    return result;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { status, json } = await postJson("/api/auth/request-password-reset", { email: email.trim() });
    return toResult(status, json, "Could not send reset code right now.");
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    const { status, json } = await postJson("/api/auth/reset-password", {
      email: email.trim(),
      code: code.trim(),
      newPassword,
    });
    const result = toUserResult(status, json, "Could not reset your password right now.");
    if (result.ok && result.user) setUser(result.user);
    return result;
  }, []);

  // ---- Passwordless / magic code flow ------------------------------------

  const requestOtp = useCallback(async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, error: "Please enter your email address." } as ApiResult;
    const { status, json } = await postJson("/api/auth/request-otp", { email: trimmed });
    return toResult(status, json, "Could not send code right now.");
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const { status, json } = await postJson("/api/auth/verify-otp", { email: email.trim(), code: code.trim() });
    const result = toUserResult(status, json, "That code didn't work.");
    if (result.ok && result.user) setUser(result.user);
    return result;
  }, []);

  // ---- Google Sign-In ----------------------------------------------------
  // The credential is a Google-issued JWT (id_token). We forward it as-is
  // to the backend, which verifies the signature server-side. We never trust
  // anything in this token client-side — the server is the source of truth.
  const loginWithGoogle = useCallback(async (credential: string) => {
    const { status, json } = await postJson("/api/auth/google", { credential });
    const result = toUserResult(status, json, "Could not sign you in with Google.");
    if (result.ok && result.user) setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* clear local state regardless */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      signup,
      verifyEmail,
      resendVerification,
      login,
      requestPasswordReset,
      resetPassword,
      requestOtp,
      verifyOtp,
      loginWithGoogle,
      logout,
      refresh,
      isLoaded: !isLoading,
      isSignedIn: !!user,
      signOut: logout,
    }),
    [user, isLoading, signup, verifyEmail, resendVerification, login, requestPasswordReset, resetPassword, requestOtp, verifyOtp, loginWithGoogle, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within <AuthProvider>");
  }
  return ctx;
}

export function useAuth(): AuthState {
  return useAuthContext();
}

export function useClerk(): AuthState {
  return useAuthContext();
}
