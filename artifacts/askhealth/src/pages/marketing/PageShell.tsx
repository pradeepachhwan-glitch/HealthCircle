import { useEffect, type ReactNode } from "react";
import { SiteHeader } from "@/pages/landing/SiteHeader";
import { SiteFooter } from "@/pages/landing/SiteFooter";
import { MarketingCrossLinks } from "./MarketingCrossLinks";

interface PageShellProps {
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  /** Plain-text document title for the browser tab + crawlers. */
  documentTitle?: string;
  /** Plain-text meta description for SEO. */
  metaDescription?: string;
}

/**
 * Shared chrome for every public marketing sub-page. Renders the SiteHeader,
 * a serif page header band, the body content the caller provides, and the
 * SiteFooter. Also resets scroll on mount so navigating between pages always
 * lands at the top, and updates document.title + meta[name="description"]
 * for per-route SEO.
 */
export default function PageShell({ eyebrow, title, intro, children, documentTitle, metaDescription }: PageShellProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

    const previousTitle = document.title;
    if (documentTitle) document.title = documentTitle;

    let descTag: HTMLMetaElement | null = null;
    let previousDescContent: string | null = null;
    let createdDescTag = false;
    if (metaDescription) {
      descTag = document.head.querySelector('meta[name="description"]');
      if (!descTag) {
        descTag = document.createElement("meta");
        descTag.setAttribute("name", "description");
        document.head.appendChild(descTag);
        createdDescTag = true;
      } else {
        previousDescContent = descTag.getAttribute("content");
      }
      descTag.setAttribute("content", metaDescription);
    }

    return () => {
      if (documentTitle) document.title = previousTitle;
      if (descTag) {
        if (createdDescTag) descTag.remove();
        else if (previousDescContent !== null) descTag.setAttribute("content", previousDescContent);
      }
    };
  }, [documentTitle, metaDescription]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white font-sans text-slate-900">
      <SiteHeader />
      <main className="flex-1">
        <header className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-0 -z-0">
            <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-indigo-50 via-white to-transparent blur-3xl" />
          </div>
          <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-16 md:pt-24 pb-10 md:pb-14">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-5">
                {eyebrow}
              </p>
            )}
            <h1 className="font-serif text-4xl md:text-[56px] leading-[1.05] text-slate-900 tracking-[-0.02em] font-medium">
              {title}
            </h1>
            {intro && (
              <p className="text-lg md:text-xl text-slate-600 max-w-2xl leading-relaxed mt-6">
                {intro}
              </p>
            )}
          </div>
        </header>

        {children}

        <MarketingCrossLinks />
      </main>
      <SiteFooter />
    </div>
  );
}
