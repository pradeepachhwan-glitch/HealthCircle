import { useEffect, useState } from "react";
import { Download, Check, Share, X } from "lucide-react";
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

  useEffect(() => {
    setPlatform(detectPlatform());
    setInstalled(isStandalone());

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

  // On iOS Safari there's no beforeinstallprompt — show "Add to Home Screen" instructions.
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
    if (platform === "ios") {
      setShowIosSheet(true);
      return;
    }
    // Other platforms with no prompt yet — show iOS-style instructions as a generic guide.
    setShowIosSheet(true);
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

      {showIosSheet && (
        <div
          className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowIosSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-8 animate-in slide-in-from-bottom"
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
            ) : (
              <ol className="space-y-3 text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Open the browser <strong>menu</strong> (⋮ on Chrome, ⋯ on Edge).</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Confirm — HealthCircle will appear on your home screen.</span>
                </li>
              </ol>
            )}

            <div className="mt-6 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 leading-relaxed">
              Once installed, HealthCircle opens like a native app — full-screen, fast, and right on your home screen.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
