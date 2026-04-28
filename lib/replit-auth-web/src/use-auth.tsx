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

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
  // Clerk-compatible aliases — let migrated pages keep their existing
  // destructuring patterns (`isLoaded`, `isSignedIn`, `signOut`) and switch
  // only the import path.
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => void;
}

export function useClerk(): AuthState {
  return useAuthContext();
}

const AuthContext = createContext<AuthState | null>(null);

interface ImportMetaWithEnv {
  env?: { BASE_URL?: string };
}

function buildLoginUrl(): string {
  const meta = import.meta as unknown as ImportMetaWithEnv;
  const base = (meta.env?.BASE_URL ?? "/").replace(/\/+$/, "") || "/";
  return `/api/login?returnTo=${encodeURIComponent(base)}`;
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

  const login = useCallback(() => {
    window.location.href = buildLoginUrl();
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/api/logout";
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refresh,
      isLoaded: !isLoading,
      isSignedIn: !!user,
      signOut: logout,
    }),
    [user, isLoading, login, logout, refresh],
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
