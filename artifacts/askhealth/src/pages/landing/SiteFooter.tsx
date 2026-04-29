import { Link } from "wouter";
import HealthCircleLogo from "@/components/HealthCircleLogo";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-12">
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
