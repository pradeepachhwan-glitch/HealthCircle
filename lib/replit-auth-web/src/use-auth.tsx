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
}

export interface OtpRequestResult {
  ok: boolean;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
}

export interface OtpVerifyResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requestOtp: (email: string) => Promise<OtpRequestResult>;
  verifyOtp: (email: string, code: string) => Promise<OtpVerifyResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  // Clerk-compatible aliases — let migrated pages keep their existing
  // destructuring patterns (`isLoaded`, `isSignedIn`, `signOut`) and switch
  // only the import path.
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function postJson<T = unknown>(url: string, body: unknown): Promise<{ status: number; json: T | null }> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: T | null = null;
  try {
    json = (await res.json()) as T;
  } catch {
    json = null;
  }
  return { status: res.status, json };
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

  const requestOtp = useCallback(async (email: string): Promise<OtpRequestResult> => {
    const trimmed = email.trim();
    if (!trimmed) return { ok: false, error: "Please enter your email address." };
    try {
      const { status, json } = await postJson<{
        success?: boolean;
        message?: string;
        error?: string;
        retryAfterSeconds?: number;
      }>("/api/auth/request-otp", { email: trimmed });
      if (status >= 200 && status < 300 && json?.success) {
        return { ok: true, message: json.message ?? "Check your email for the code." };
      }
      return {
        ok: false,
        error: json?.error ?? "Could not send code right now. Please try again.",
        retryAfterSeconds: json?.retryAfterSeconds,
      };
    } catch {
      return { ok: false, error: "Network error. Please check your connection and try again." };
    }
  }, []);

  const verifyOtp = useCallback(
    async (email: string, code: string): Promise<OtpVerifyResult> => {
      try {
        const { status, json } = await postJson<{
          success?: boolean;
          user?: AuthUser;
          error?: string;
        }>("/api/auth/verify-otp", { email: email.trim(), code: code.trim() });
        if (status >= 200 && status < 300 && json?.success && json.user) {
          setUser(json.user);
          return { ok: true, user: json.user };
        }
        return { ok: false, error: json?.error ?? "That code didn't work. Please try again." };
      } catch {
        return { ok: false, error: "Network error. Please check your connection and try again." };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore — clear local state anyway */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      requestOtp,
      verifyOtp,
      logout,
      refresh,
      isLoaded: !isLoading,
      isSignedIn: !!user,
      signOut: logout,
    }),
    [user, isLoading, requestOtp, verifyOtp, logout, refresh],
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
