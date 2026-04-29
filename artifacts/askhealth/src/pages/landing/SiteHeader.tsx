import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield, Mail, MessageCircle } from "lucide-react";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import PWAInstallButton from "@/components/PWAInstallButton";
import { NAV_ITEMS } from "./data";
import { mailtoUrl, whatsappUrl, SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [location]);

  return (
    <header
      className={[
        "sticky top-0 z-30 bg-white/85 backdrop-blur-md transition-[border-color,box-shadow] duration-200",
        scrolled ? "border-b border-slate-200/80 shadow-[0_1px_0_rgba(15,23,42,0.04)]" : "border-b border-transparent",
      ].join(" ")}
    >
      <div
        className="max-w-7xl mx-auto px-4 lg:px-8 h-16 lg:h-[68px] flex items-center justify-between"
        style={{
          // Respect the iPhone notch / Android display cutout when the page
          // is viewed in standalone PWA mode. env() falls back to 0 in
          // browsers that don't support it.
          paddingTop: "max(0px, env(safe-area-inset-top))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <div className="flex items-center gap-2">
          <Link href="/" className="cursor-pointer">
            <HealthCircleLogo size="xs" animate={true} />
          </Link>
          {/* Privacy-first contact buttons beside the logo — no email/phone exposed
              in the rendered DOM; click reveals only to the user's mail/WhatsApp app.
              Hidden until xl so the desktop header doesn't cram at 1024–1279px. */}
          <div className="hidden xl:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
            <a
              href={mailtoUrl("HealthCircle Enquiry")}
              aria-label={`Email us — opens your mail app to ${SUPPORT_EMAIL}`}
              title="Email us"
              data-testid="header-email"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Mail className="h-4 w-4" strokeWidth={2} />
              <span className="sr-only">Email</span>
            </a>
            <a
              href={whatsappUrl("Hi HealthCircle team — I have a question.")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Message us on WhatsApp — opens chat with ${SUPPORT_WHATSAPP_DISPLAY}`}
              title="Chat on WhatsApp"
              data-testid="header-whatsapp"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              <span className="sr-only">WhatsApp</span>
            </a>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1 text-sm font-medium text-slate-700">
          {NAV_ITEMS.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "px-3 xl:px-3.5 py-2 rounded-lg transition-colors duration-200 whitespace-nowrap",
                  active ? "text-slate-900 bg-slate-100/70" : "hover:text-slate-900 hover:bg-slate-50",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-1 xl:gap-1.5">
          <PWAInstallButton variant="ghost" label="Install app" />
          {/* Admin link hidden at the in-between lg viewport (1024-1279px) so
              the row doesn't cram; admins can still reach it via the
              hamburger menu or by navigating directly to /admin. */}
          <Link
            href="/sign-in?next=%2Fadmin"
            className="hidden xl:inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
            data-testid="landing-admin-link"
          >
            <Shield className="h-3.5 w-3.5" strokeWidth={2} />
            Admin
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium px-3 xl:px-3.5 py-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Sign in
          </Link>
          <Link
            href="/#try-yukti"
            className="text-sm font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-all duration-200 whitespace-nowrap"
          >
            Try Yukti free
          </Link>
        </div>

        <div className="lg:hidden flex items-center gap-1">
          <PWAInstallButton variant="compact" label="Install" />
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2.5 rounded-lg hover:bg-slate-100 text-slate-700 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-header-mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-header-mobile-nav" className="lg:hidden border-t border-slate-200 bg-white shadow-lg">
          <nav className="px-4 py-3 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2.5 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-3 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
              <Link
                href="/sign-in"
                className="text-center text-sm font-medium px-4 py-2.5 border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                Sign in
              </Link>
              <Link
                href="/#try-yukti"
                className="text-center text-sm font-semibold px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Try Yukti free
              </Link>
            </div>
            <Link
              href="/sign-in?next=%2Fadmin"
              className="block text-center text-xs font-medium px-4 py-2 mt-1 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg"
              data-testid="landing-admin-link-mobile"
            >
              Admin
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
