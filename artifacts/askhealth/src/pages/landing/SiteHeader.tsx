import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Shield } from "lucide-react";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import PWAInstallButton from "@/components/PWAInstallButton";
import { NAV_ITEMS } from "./data";

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
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-[68px] flex items-center justify-between">
        <Link href="/" className="cursor-pointer">
          <HealthCircleLogo size="sm" animate={false} />
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600">
          {NAV_ITEMS.map((item) => {
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "px-3.5 py-2 rounded-lg transition-colors duration-200",
                  active ? "text-slate-900 bg-slate-100/70" : "hover:text-slate-900 hover:bg-slate-50",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-1.5">
          <PWAInstallButton variant="ghost" label="Install app" />
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
            data-testid="landing-admin-link"
          >
            <Shield className="h-3.5 w-3.5" strokeWidth={2} />
            Admin
          </Link>
          <Link
            href="/sign-in"
            className="text-sm font-medium px-3.5 py-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/#try-yukti"
            className="text-sm font-semibold px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-all duration-200"
          >
            Try Yukti free
          </Link>
        </div>

        <div className="md:hidden flex items-center gap-1">
          <PWAInstallButton variant="compact" label="Install" />
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-700"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-header-mobile-nav"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="site-header-mobile-nav" className="md:hidden border-t border-slate-200 bg-white shadow-lg">
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
              href="/admin"
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
