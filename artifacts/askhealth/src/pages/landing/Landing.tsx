import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Hero } from "./sections/Hero";
import { TrustBand } from "./sections/TrustBand";
import { Pillars } from "./sections/Pillars";
import { CommunitiesPreview } from "./sections/CommunitiesPreview";
import { HowItWorks } from "./sections/HowItWorks";
import { TeleConsultTeaser } from "./sections/TeleConsultTeaser";

export default function Landing() {
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
