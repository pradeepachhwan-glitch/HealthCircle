import { useEffect } from "react";
import { useLocation } from "wouter";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Hero } from "./sections/Hero";
import { TrustBand } from "./sections/TrustBand";
import { Pillars } from "./sections/Pillars";
import { CommunitiesPreview } from "./sections/CommunitiesPreview";
import { HowItWorks } from "./sections/HowItWorks";
import { TeleConsultTeaser } from "./sections/TeleConsultTeaser";

/**
 * If the URL contains a hash like `#try-yukti` (typically after a cross-page
 * link from /solutions etc.), smoothly scroll the matching element into view
 * once it has mounted. Wouter does not include the hash in `location`, so we
 * also listen to native `hashchange` events for in-page taps.
 */
function useHashScroll() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const scrollToHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      // Try a few frames in case the target hasn't mounted yet (e.g. coming
      // straight from another route where Landing is still mounting).
      let attempts = 0;
      const tryScroll = () => {
        const el = document.getElementById(hash);
        if (!el) {
          if (attempts++ < 6) requestAnimationFrame(tryScroll);
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Force the animation to re-trigger even if class was already present.
        el.classList.remove("ring-flash");
        void el.offsetWidth;
        el.classList.add("ring-flash");
      };
      requestAnimationFrame(tryScroll);
    };

    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [location]);
}

export default function Landing() {
  useHashScroll();
  return (
    <div className="min-h-[100dvh] flex flex-col bg-white font-sans text-slate-900">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustBand />
        <Pillars />
        <CommunitiesPreview />
        <HowItWorks />
        <TeleConsultTeaser />
      </main>
      <SiteFooter />
    </div>
  );
}
