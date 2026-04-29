import { Link } from "wouter";
import { Mail, MessageCircle } from "lucide-react";
import HealthCircleLogo from "@/components/HealthCircleLogo";
import { mailtoUrl, whatsappUrl, SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 md:gap-12">
          <div className="col-span-2 md:col-span-2">
            <HealthCircleLogo size="sm" animate={false} />
            <p className="text-sm text-slate-500 mt-4 max-w-xs leading-relaxed">
              India's AI healthcare companion. Calm, evidence-backed health guidance —
              alongside trusted communities and verified doctors.
            </p>
            <p className="text-xs text-slate-400 mt-4 leading-relaxed">
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
            <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">Contact us</p>
            <ul className="space-y-3">
              <li>
                <a
                  href={mailtoUrl("HealthCircle Enquiry")}
                  className="group flex items-center gap-2.5 text-sm text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] py-1.5 -mx-1.5 px-1.5 rounded-lg hover:bg-slate-50"
                  data-testid="footer-email"
                  aria-label={`Email us at ${SUPPORT_EMAIL}`}
                >
                  <span className="w-11 h-11 rounded-xl bg-rose-50 ring-1 ring-rose-100 flex items-center justify-center flex-shrink-0 group-hover:bg-rose-100 transition-colors">
                    <Mail className="w-4 h-4 text-rose-700" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium text-slate-900 text-[13px]">Email</span>
                    <span className="text-xs text-slate-500 break-all">{SUPPORT_EMAIL}</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={whatsappUrl("Hi HealthCircle team — I have a question.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2.5 text-sm text-slate-500 hover:text-slate-900 transition-colors min-h-[44px] py-1.5 -mx-1.5 px-1.5 rounded-lg hover:bg-slate-50"
                  data-testid="footer-whatsapp"
                  aria-label={`Chat with us on WhatsApp at ${SUPPORT_WHATSAPP_DISPLAY}`}
                >
                  <span className="w-11 h-11 rounded-xl bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <MessageCircle className="w-4 h-4 text-emerald-700" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="font-medium text-slate-900 text-[13px]">WhatsApp</span>
                    <span className="text-xs text-slate-500">{SUPPORT_WHATSAPP_DISPLAY}</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            © {year} HealthCircle · India-first AI healthcare
          </p>
          <p className="text-xs text-slate-400">English · हिंदी (more languages coming)</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map(([label, href]) => (
          <li key={label + href}>
            <Link
              href={href}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
