import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Check,
  Share,
  X,
  ExternalLink,
  MoreVertical,
  Plus,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

type Platform = "ios" | "android-chrome" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes("mac") && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/android/.test(ua)) return "android-chrome";
  if (/windows|macintosh|linux|cros/.test(ua)) return "desktop";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if ((navigator as NavigatorWithStandalone).standalone === true) return true;
  return document.referrer.startsWith("android-app://");
}

// Browsers will not fire `beforeinstallprompt` inside a cross-origin iframe
// (e.g. the Replit preview iframe). Detect that so we can guide the user to
// open the app in a real browser tab where install actually works.
function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin frame access throws — that itself confirms we're framed.
    return true;
  }
}

// In-app webviews (Instagram, Facebook, TikTok, LinkedIn, X, WeChat,
// Snapchat, etc.) cannot install PWAs at all — they're sandboxed Chrome /
// WKWebView instances without the native browser chrome. The honest fix is
// to send the user to their real browser before showing instructions.
function detectInAppBrowser(): { isInApp: boolean; appName: string | null } {
  if (typeof navigator === "undefined") return { isInApp: false, appName: null };
  const ua = navigator.userAgent;
  const checks: Array<[RegExp, string]> = [
    [/Instagram/i, "Instagram"],
    [/FBAN|FBAV|FB_IAB/i, "Facebook"],
    [/(TikTok|BytedanceWebview|Bytedance)/i, "TikTok"],
    [/LinkedInApp/i, "LinkedIn"],
    [/Twitter|TwitterAndroid/i, "X / Twitter"],
    [/MicroMessenger/i, "WeChat"],
    [/Snapchat/i, "Snapchat"],
    [/Line\//i, "Line"],
    [/KAKAOTALK/i, "KakaoTalk"],
  ];
  for (const [pattern, name] of checks) {
    if (pattern.test(ua)) return { isInApp: true, appName: name };
  }
  return { isInApp: false, appName: null };
}

export interface PWAInstallButtonProps {
  variant?: "primary" | "ghost" | "compact";
  className?: string;
  label?: string;
}

export default function PWAInstallButton({
  variant = "primary",
  className = "",
  label = "Install app",
}: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const [showSheet, setShowSheet] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [framed, setFramed] = useState(false);
  const [inApp, setInApp] = useState<{ isInApp: boolean; appName: string | null }>({
    isInApp: false,
    appName: null,
  });

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setFramed(isInIframe());
    setInApp(detectInAppBrowser());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowSheet(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // If already installed as a PWA, show a subtle confirmation pill instead of an install button.
  if (installed) {
    if (variant === "compact") return null;
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium ${className}`}
        data-testid="pwa-installed-pill"
      >
        <Check className="w-3.5 h-3.5" />
        Installed
      </div>
    );
  }

  // One-tap path: if Chrome / Edge / Brave / Opera have given us a deferred
  // prompt, fire the native install dialog directly without ever opening
  // our own sheet. This is the best possible UX when the browser allows it.
  const handleClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
        // If the native prompt errors out for any reason, fall back to the
        // sheet so the user is never left with a "nothing happened" tap.
        setShowSheet(true);
      }
      return;
    }
    setShowSheet(true);
  };

  const openInBrowser = () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const baseClasses =
    variant === "primary"
      ? "bg-ai-gradient text-white shadow-ai-glow hover:opacity-95"
      : variant === "compact"
      ? "h-9 px-3 text-xs bg-primary/10 hover:bg-primary/15 text-primary border-0"
      : "bg-white/90 text-slate-900 hover:bg-white border border-slate-200";

  // Decide which "state" to show inside the sheet. Order matters:
  //   1. In-app webviews physically can't install — surface that first.
  //   2. Replit preview iframe — also can't install, but the fix is to open
  //      the deployed URL in a real tab.
  //   3. Otherwise, show platform-appropriate manual instructions.
  const sheetState: "in-app" | "framed" | "manual" = inApp.isInApp
    ? "in-app"
    : framed
    ? "framed"
    : "manual";

  return (
    <>
      <Button
        type="button"
        onClick={handleClick}
        className={`${baseClasses} ${className} font-semibold`}
        size={variant === "compact" ? "sm" : "default"}
        data-testid="pwa-install-button"
      >
        <Download className={variant === "compact" ? "w-3.5 h-3.5 mr-1.5" : "w-4 h-4 mr-2"} />
        {label}
      </Button>

      {showSheet && typeof document !== "undefined" && createPortal(
        // Rendered into document.body via portal — the SiteHeader uses
        // backdrop-filter, which would otherwise create a containing block
        // and trap this fixed overlay inside the 64px header strip.
        <div
          className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 animate-in slide-in-from-bottom max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <SheetHeader onClose={() => setShowSheet(false)} />

            <StatusBanner state={sheetState} appName={inApp.appName} platform={platform} />

            {sheetState === "in-app" && (
              <InAppBlock appName={inApp.appName} onOpen={openInBrowser} />
            )}

            {sheetState === "framed" && (
              <FramedBlock onOpen={openInBrowser} />
            )}

            {sheetState === "manual" && (
              <>
                {platform === "ios" && <IOSInstructions />}
                {platform === "android-chrome" && <AndroidChromeInstructions />}
                {(platform === "desktop" || platform === "other") && <DesktopInstructions />}
              </>
            )}

            <Footnote />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sheet sub-components. Kept in the same file so the install flow lives in
// one place; each is small and presentational.
// ───────────────────────────────────────────────────────────────────────────

function SheetHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-ai-gradient rounded-xl flex items-center justify-center shadow-ai-glow">
          <Download className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 id="pwa-install-title" className="text-lg font-bold text-slate-900">
            Install HealthCircle
          </h3>
          <p className="text-xs text-slate-500">Add to your Home Screen</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 p-1 min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center"
        aria-label="Close install instructions"
        data-testid="close-install-sheet"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// Honest, state-aware top banner. Tells the user why they're seeing
// instructions instead of a one-tap install.
function StatusBanner({
  state,
  appName,
  platform,
}: {
  state: "in-app" | "framed" | "manual";
  appName: string | null;
  platform: Platform;
}) {
  if (state === "in-app") {
    return (
      <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs leading-relaxed flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">Can't install from {appName ?? "this app"}.</div>
          In-app browsers don't support installing web apps. Open HealthCircle
          in your normal browser (Chrome / Safari) and try again — it takes one tap.
        </div>
      </div>
    );
  }
  if (state === "framed") {
    return (
      <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs leading-relaxed flex gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">You're inside a preview window.</div>
          Browsers only allow installing from a real tab. Open HealthCircle in
          your browser, then tap Install.
        </div>
      </div>
    );
  }
  // Manual instructions case.
  if (platform === "ios") {
    return (
      <div className="mb-4 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs leading-relaxed flex gap-2">
        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">iPhone / iPad — two quick taps.</div>
          Apple doesn't let websites install themselves on iOS, so we'll show
          you exactly where to tap in Safari.
        </div>
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs leading-relaxed flex gap-2">
      <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>
        <div className="font-semibold">Your browser hasn't offered the one-tap install yet.</div>
        Some browsers wait until you've used the site for a few seconds. You
        can install manually right now using the steps below.
      </div>
    </div>
  );
}

function InAppBlock({ appName, onOpen }: { appName: string | null; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.origin + "/" : "";

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked inside webviews; the manual fallback below
      // (open the in-app menu and choose "Open in browser") still works.
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700 leading-relaxed">
        The most reliable way: tap the <strong>⋯ / ⋮ menu</strong> inside{" "}
        {appName ?? "this app"} and choose <strong>"Open in browser"</strong> (or
        "Open in Chrome" / "Open in Safari"). Then tap Install on the page that opens.
      </p>
      <Button
        type="button"
        onClick={onOpen}
        className="w-full bg-ai-gradient text-white shadow-ai-glow"
        data-testid="pwa-open-in-browser"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Try opening in a new tab
      </Button>
      <Button
        type="button"
        onClick={copyLink}
        variant="outline"
        className="w-full"
        data-testid="pwa-copy-link"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2 text-emerald-600" />
            Link copied — paste into your browser
          </>
        ) : (
          <>Copy link to paste in your browser</>
        )}
      </Button>
    </div>
  );
}

function FramedBlock({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={onOpen}
        className="w-full bg-ai-gradient text-white shadow-ai-glow"
        data-testid="pwa-open-in-browser"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Open HealthCircle in my browser
      </Button>
      <p className="text-xs text-slate-500 text-center">
        After it opens in a new tab, tap Install again.
      </p>
    </div>
  );
}

// Numbered step card with an inline visual preview of the UI element to tap.
function StepCard({
  number,
  title,
  preview,
}: {
  number: number;
  title: React.ReactNode;
  preview: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 leading-relaxed">{title}</p>
        {preview != null && <div className="mt-2">{preview}</div>}
      </div>
    </div>
  );
}

// ───────── iOS Safari ─────────
function IOSInstructions() {
  return (
    <ol className="space-y-4">
      <StepCard
        number={1}
        title={
          <>
            Tap the <strong>Share</strong> icon at the bottom of Safari.
          </>
        }
        preview={
          // Mockup of Safari's bottom toolbar with the Share icon highlighted
          // in our brand color so the user can recognize it instantly.
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 flex items-center justify-around text-slate-400">
            <span className="w-5 h-5 inline-block">‹</span>
            <span className="w-5 h-5 inline-block">›</span>
            <span
              className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 text-primary ring-2 ring-primary animate-pulse"
              aria-label="Safari Share button"
            >
              <Share className="w-4 h-4" />
            </span>
            <span className="w-5 h-5 inline-block">▢</span>
            <span className="w-5 h-5 inline-block">⊟</span>
          </div>
        }
      />
      <StepCard
        number={2}
        title={
          <>
            Scroll the menu and tap <strong>"Add to Home Screen"</strong>.
          </>
        }
        preview={
          // Mockup of the iOS Share sheet row the user is looking for.
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
              <span>Copy</span>
              <span>📋</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 text-sm text-slate-900 font-medium bg-primary/5 ring-2 ring-primary rounded-lg">
              <span>Add to Home Screen</span>
              <Plus className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400">
              <span>Add Bookmark</span>
              <span>📑</span>
            </div>
          </div>
        }
      />
      <StepCard
        number={3}
        title={
          <>
            Tap <strong>Add</strong> in the top-right corner — done!
          </>
        }
        preview={null}
      />
    </ol>
  );
}

// ───────── Android Chrome ─────────
function AndroidChromeInstructions() {
  return (
    <ol className="space-y-4">
      <StepCard
        number={1}
        title={
          <>
            Tap the <strong>⋮ menu</strong> in the top-right of Chrome.
          </>
        }
        preview={
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 flex items-center justify-end gap-2">
            <span className="text-xs text-slate-400 mr-auto truncate">
              {typeof window !== "undefined" ? window.location.host : "hcircle.app"}
            </span>
            <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">⟳</span>
            <span
              className="w-9 h-9 rounded-lg bg-primary/15 text-primary ring-2 ring-primary animate-pulse flex items-center justify-center"
              aria-label="Chrome menu button"
            >
              <MoreVertical className="w-4 h-4" />
            </span>
          </div>
        }
      />
      <StepCard
        number={2}
        title={
          <>
            Tap <strong>"Install app"</strong> (or <strong>"Add to Home screen"</strong>).
          </>
        }
        preview={
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
              <span>New tab</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-900 font-medium bg-primary/5 ring-2 ring-primary rounded-lg">
              <Download className="w-4 h-4 text-primary" />
              <span>Install app</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
              <span>Bookmarks</span>
            </div>
          </div>
        }
      />
      <StepCard
        number={3}
        title={<>Tap <strong>Install</strong> in the popup — HealthCircle lands on your home screen.</>}
        preview={null}
      />
    </ol>
  );
}

// ───────── Desktop fallback ─────────
function DesktopInstructions() {
  return (
    <ol className="space-y-4">
      <StepCard
        number={1}
        title={
          <>
            Look for the <strong>install icon</strong> at the right end of the address bar.
          </>
        }
        preview={
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 flex items-center gap-2">
            <span className="text-xs text-slate-400 truncate flex-1">
              {typeof window !== "undefined" ? window.location.host : "hcircle.app"}
            </span>
            <span
              className="w-9 h-7 rounded-md bg-primary/15 text-primary ring-2 ring-primary animate-pulse flex items-center justify-center"
              aria-label="Browser install icon"
            >
              <Download className="w-4 h-4" />
            </span>
          </div>
        }
      />
      <StepCard
        number={2}
        title={
          <>
            Or open the browser menu (<strong>⋮</strong> in Chrome, <strong>⋯</strong> in Edge)
            and pick <strong>"Install HealthCircle"</strong>.
          </>
        }
        preview={null}
      />
      <StepCard
        number={3}
        title={<>Confirm — HealthCircle opens in its own window with no browser bars.</>}
        preview={null}
      />
    </ol>
  );
}

function Footnote() {
  return (
    <div className="mt-5 pt-4 border-t border-slate-100">
      <p className="text-[11px] text-slate-400 leading-relaxed">
        Once installed, HealthCircle launches like a native app — full-screen,
        with offline support. It uses the same secure connection as your
        browser; we don't get any extra access.
      </p>
    </div>
  );
}
