import { useEffect, useRef, useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";

/**
 * Google Sign-In button (Google Identity Services / GIS).
 *
 * Behaviour:
 * 1. On mount, fetches /api/auth/config to discover whether the server has
 *    a GOOGLE_CLIENT_ID configured. If not, the component renders nothing
 *    so the sign-in page degrades gracefully when Google is not set up yet.
 * 2. If a client ID is present, lazily injects the GIS script (only once
 *    per page load — guarded by a module-level promise) and asks Google to
 *    render its official "Sign in with Google" button into our container.
 * 3. When the user completes the Google flow, GIS invokes our `callback`
 *    with `{ credential: <JWT> }`. We forward that JWT to the backend via
 *    `loginWithGoogle()` which verifies it server-side and creates a
 *    session cookie. On success we call `onSuccess()` so the parent can
 *    route to the post-login destination; on failure we surface the
 *    server's error message via `onError()`.
 *
 * Why we render Google's official button (instead of styling our own):
 * - Google's brand guidelines REQUIRE specific styling, wording, and the
 *   coloured "G" mark. Rolling our own would technically violate the
 *   Identity Services terms of use.
 * - Google's button is automatically translated, accessible, and adapts
 *   to user state ("Sign in with Google" vs "Continue as <name>" if the
 *   browser already has a session).
 */

interface Props {
  onSuccess: () => void;
  onError: (message: string) => void;
  /** Localised label hint passed to GIS. Defaults to "signin_with". */
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
}

// ---- GIS script loader (shared across all button instances) ----
// We cache a successful load promise so multiple buttons share one network
// request, but we reset the cache on FAILURE so a transient load error
// (ad-blocker briefly engaged, flaky network) doesn't permanently brick
// the button until full page refresh — the next mount/retry can try again.
const GIS_SRC = "https://accounts.google.com/gsi/client";
let gisLoadPromise: Promise<void> | null = null;
function loadGisScript(): Promise<void> {
  if (gisLoadPromise) return gisLoadPromise;
  const promise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no-window"));
    if ((window as unknown as { google?: { accounts?: unknown } }).google?.accounts) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("gis-load-error")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("gis-load-error"));
    document.head.appendChild(s);
  });
  // Clear the cache on failure so a retry can happen.
  promise.catch(() => {
    if (gisLoadPromise === promise) gisLoadPromise = null;
  });
  gisLoadPromise = promise;
  return promise;
}

// ---- Minimal type surface of the GIS API we touch ----
interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}
interface GoogleAccountsId {
  initialize: (cfg: {
    client_id: string;
    callback: (resp: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (
    el: HTMLElement,
    cfg: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "small" | "medium" | "large";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    },
  ) => void;
}
interface WindowWithGoogle extends Window {
  google?: { accounts?: { id?: GoogleAccountsId } };
}

export function GoogleSignInButton({ onSuccess, onError, text = "continue_with" }: Props) {
  const { loginWithGoogle } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [configChecked, setConfigChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Step 1: ask the server whether Google sign-in is configured. We do this
  // at runtime (not via a Vite env var baked at build time) so flipping the
  // GOOGLE_CLIENT_ID env on the server takes effect on the very next page
  // load — no rebuild needed.
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/config", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { googleClientId: string | null } | null) => {
        if (!alive) return;
        setClientId(data?.googleClientId ?? null);
        setConfigChecked(true);
      })
      .catch(() => {
        if (!alive) return;
        setConfigChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Step 2: once we have a clientId, load GIS and render the button.
  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    loadGisScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const w = window as WindowWithGoogle;
        const gid = w.google?.accounts?.id;
        if (!gid) {
          onError("Google sign-in failed to load. Please refresh the page.");
          return;
        }

        gid.initialize({
          client_id: clientId,
          callback: async (resp) => {
            if (!resp.credential) {
              onError("Google did not return a credential. Please try again.");
              return;
            }
            setBusy(true);
            try {
              const result = await loginWithGoogle(resp.credential);
              if (result.ok) {
                onSuccess();
              } else {
                onError(result.error ?? "Could not sign you in with Google.");
              }
            } finally {
              setBusy(false);
            }
          },
          // We DON'T enable auto_select here — that would silently sign in
          // returning users without any tap, which is great on a landing
          // page but surprising on the explicit /sign-in page where the
          // user came specifically to choose a method. We can enable
          // auto-select later from a landing-page-only One Tap component.
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
        });

        // Render Google's official button. Width 0 = full width of parent.
        // Container width is read at render time so we pass an explicit px
        // value (GIS doesn't accept "100%").
        const w_px = Math.min(360, Math.max(240, containerRef.current.clientWidth || 320));
        containerRef.current.innerHTML = ""; // clean re-renders on hot reload
        gid.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "pill",
          logo_alignment: "left",
          width: w_px,
        });
      })
      .catch(() => {
        onError("Could not load Google sign-in. Please check your connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle, onError, onSuccess, text]);

  // Render NOTHING while config check is in flight, or if Google isn't
  // configured. This means the email/password form stays uncluttered for
  // any deployment that hasn't enabled Google yet.
  if (!configChecked) {
    return (
      <div className="h-11 flex items-center justify-center text-xs text-slate-400">
        <Loader2Spinner />
      </div>
    );
  }
  if (!clientId) {
    // Help future-us / future-developers debug "where did the Google
    // button go?" — the only reason we render nothing is that the server
    // hasn't been given a GOOGLE_CLIENT_ID. Logged once per page load.
    if (typeof window !== "undefined" && !(window as { __healthcircleGoogleWarned?: boolean }).__healthcircleGoogleWarned) {
      (window as { __healthcircleGoogleWarned?: boolean }).__healthcircleGoogleWarned = true;
      console.warn("[HealthCircle] Google sign-in button hidden: server returned no googleClientId. Set GOOGLE_CLIENT_ID in the API server's environment to enable it.");
    }
    return null;
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="flex justify-center [&>div]:!w-full"
        data-testid="google-signin-button"
      />
      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-full">
          <Loader2Spinner />
        </div>
      )}
    </div>
  );
}

function Loader2Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
