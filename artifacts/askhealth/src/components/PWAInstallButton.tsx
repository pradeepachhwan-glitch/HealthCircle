import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Check, Share, X, ExternalLink } from "lucide-react";
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
  if (/windows|macintosh|linux/.test(ua)) return "desktop";
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
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");
  const [framed, setFramed] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());
    setFramed(isInIframe());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
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

  // Click handler always shows *something*: native prompt if available,
  // otherwise platform-specific instructions sheet.
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
        // ignore
      }
      return;
    }
    setShowIosSheet(true);
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

      {showIosSheet && typeof document !== "undefined" && createPortal(
        // Rendered into document.body via portal — the SiteHeader uses
        // backdrop-filter, which would otherwise create a containing block
        // and trap this fixed overlay inside the 64px header strip.
        <div
          className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowIosSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div
            // max-h + overflow-y-auto: on short phones (e.g. landscape, or
            // when the framed banner is also shown) the sheet content can
            // exceed viewport height. dvh respects the dynamic mobile URL bar,
            // and the env() insets keep us clear of iOS notches and home bars.
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto"
            style={{
              paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                onClick={() => setShowIosSheet(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close install instructions"
                data-testid="close-install-sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {framed && (
              <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs leading-relaxed">
                <div className="font-semibold mb-1">You're viewing HealthCircle inside a preview window.</div>
                Browsers only allow installing a Progressive Web App from a real
                browser tab — not from inside an embedded frame. Open it in your
                browser first, then tap Install.
                <Button
                  type="button"
                  onClick={openInBrowser}
                  className="mt-3 w-full bg-amber-600 hover:bg-amber-700 text-white"
                  size="sm"
                  data-testid="pwa-open-in-browser"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open HealthCircle in my browser
                </Button>
              </div>
            )}

            {platform === "ios" ? (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>
                    Tap the <Share className="inline w-4 h-4 -mt-0.5" /> <strong>Share</strong> button at the bottom of Safari.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Scroll and tap <strong>"Add to Home Screen"</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Tap <strong>Add</strong> — and you're done!</span>
                </li>
              </ol>
            ) : platform === "android-chrome" ? (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Tap the <strong>⋮ menu</strong> in the top-right of Chrome.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Confirm — the HealthCircle icon will appear on your home screen.</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Look for the <strong>install icon</strong> (a small monitor with a down-arrow) in your address bar.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Or open the browser <strong>menu</strong> (⋮ Chrome, ⋯ Edge) and pick <strong>"Install HealthCircle"</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Confirm — HealthCircle opens in its own window with no browser bars.</span>
                </li>
              </ol>
            )}

            <div className="mt-6 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed">
              {deferredPrompt
                ? `Once installed, HealthCircle opens like a native app — full-screen, fast, and right on your home screen.`
                : `Some browsers only show the one-tap install button after you've spent a few seconds on the site. The steps above work in supported browsers (Chrome, Edge, Brave, Samsung Internet, and iOS Safari). In-app browsers like Instagram or Facebook can't install PWAs — open the link in your normal browser first.`}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
