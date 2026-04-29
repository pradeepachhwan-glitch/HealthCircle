import { Link } from "wouter";
import { Mail, MessageCircle } from "lucide-react";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import { mailtoUrl, whatsappUrl, SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

/**
 * Public footer.
 *
 * Privacy: support email + WhatsApp number are NOT printed on the page.
 * Bots scraping the public footer never see the address. Each contact is
 * exposed only as an icon-button — clicking it opens the user's mail client
 * or WhatsApp directly. The full address is in the `aria-label` only, so
 * assistive tech can announce it but it doesn't appear in the rendered DOM
 * text content.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 md:gap-12">
          <div className="col-span-2 md:col-span-2">
            <HealthCircleLogo size="sm" animate={false} />

            {/* Compact, privacy-respecting contact row right beside the logo —
                icon buttons only, no email or phone text exposed. */}
            <div className="mt-4 flex items-center gap-2">
              <a
                href={mailtoUrl("HealthCircle Enquiry")}
                aria-label={`Email us — opens your mail app to ${SUPPORT_EMAIL}`}
                title="Email us"
                data-testid="footer-email"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-xl bg-rose-50 ring-1 ring-rose-100 text-rose-700 hover:bg-rose-100 hover:ring-rose-200 hover:scale-105 transition-all"
              >
                <Mail className="w-4 h-4" strokeWidth={2} />
                <span className="sr-only">Email</span>
              </a>
              <a
                href={whatsappUrl("Hi HealthCircle team — I have a question.")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Message us on WhatsApp — opens chat with ${SUPPORT_WHATSAPP_DISPLAY}`}
                title="Chat on WhatsApp"
                data-testid="footer-whatsapp"
                className="group inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:ring-emerald-200 hover:scale-105 transition-all"
              >
                <MessageCircle className="w-4 h-4" strokeWidth={2} />
                <span className="sr-only">WhatsApp</span>
              </a>
              <span className="text-xs font-medium text-slate-600 ml-1">Contact us</span>
            </div>

            <p className="text-sm text-slate-600 mt-5 max-w-xs leading-relaxed">
              India's AI healthcare companion. Calm, evidence-backed health guidance —
              alongside trusted communities and verified doctors.
            </p>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              Yukti provides health information for educational purposes only.
              Always consult a qualified doctor for medical decisions.
            </p>
          </div>

          <FooterCol title="Product" links={[
            ["Solutions", "/solutions"],
            ["For Doctors", "/for-doctors"],
            ["Sign in", "/sign-in"],
            ["Try Yukti free", "/#try-yukti"],
          ]} />

          <FooterCol title="Company" links={[
            ["About", "/about"],
            ["Support", "/support"],
          ]} />

          <FooterCol title="Legal" links={[
            ["Terms", "/terms"],
            ["Privacy", "/privacy"],
          ]} />

          <div className="col-span-2 md:col-span-1">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Reach us</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Questions, partnerships, or just saying hello — we typically reply within 24 hours.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={mailtoUrl("HealthCircle Enquiry")}
                aria-label={`Email us — opens your mail app to ${SUPPORT_EMAIL}`}
                title="Email"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" strokeWidth={2.25} /> Email
              </a>
              <a
                href={whatsappUrl("Hi HealthCircle team — I have a question.")}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Message us on WhatsApp — opens chat with ${SUPPORT_WHATSAPP_DISPLAY}`}
                title="WhatsApp"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.25} /> WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            © {year} HealthCircle · India-first AI healthcare
          </p>
          <p className="text-xs text-slate-500">English · हिंदी (more languages coming)</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label + href}>
            <Link
              href={href}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
