import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import HealthCircleLogo from "@/components/HealthCircleLogo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`${basePath}/`}>
            <div className="inline-flex cursor-pointer">
              <HealthCircleLogo size="sm" animate={true} />
            </div>
          </Link>
          <Link href={`${basePath}/`} className="text-sm text-slate-500 hover:text-primary inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 prose prose-slate max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-lg prose-h2:mt-8 prose-p:text-slate-600 prose-li:text-slate-600">
          <h1>HealthCircle / AskHealth AI</h1>
          <h2 className="!mt-2 !text-xl text-slate-700">Privacy Policy</h2>
          <p className="text-sm text-slate-500"><strong>Effective Date:</strong> April 27, 2026</p>

          <h2>2.1 Information We Collect</h2>
          <h3>a. Personal Information</h3>
          <ul>
            <li>Name, email address, phone number</li>
            <li>Login and account credentials</li>
          </ul>
          <h3>b. Health &amp; Interaction Data</h3>
          <ul>
            <li>Symptoms, questions, and health-related inputs</li>
            <li>Interaction history with AI and community features</li>
          </ul>
          <h3>c. Technical &amp; Usage Data</h3>
          <ul>
            <li>Device type, browser information</li>
            <li>IP address, cookies, and analytics data</li>
          </ul>

          <h2>2.2 How We Use Your Information</h2>
          <p>Your data is used to:</p>
          <ul>
            <li>Deliver AI-powered responses and community features</li>
            <li>Improve accuracy, safety, and performance</li>
            <li>Personalize user experience</li>
            <li>Monitor and prevent misuse</li>
          </ul>

          <h2>2.3 Data Sharing &amp; Disclosure</h2>
          <p>We do not sell your personal data.</p>
          <p>We may share data with:</p>
          <ul>
            <li>Trusted third-party service providers (e.g., hosting, analytics)</li>
            <li>Legal or regulatory authorities, when required by law</li>
          </ul>

          <h2>2.4 Data Security</h2>
          <p>We implement reasonable technical and organizational safeguards, including:</p>
          <ul>
            <li>Encryption where applicable</li>
            <li>Secure access controls</li>
            <li>Continuous monitoring</li>
          </ul>
          <p>However, no digital platform can guarantee absolute security.</p>

          <h2>2.5 Data Retention</h2>
          <p>We retain your data:</p>
          <ul>
            <li>For as long as your account remains active</li>
            <li>As required to comply with legal obligations or resolve disputes</li>
          </ul>

          <h2>2.6 Your Rights</h2>
          <p>You may:</p>
          <ul>
            <li>Request access to your personal data</li>
            <li>Request correction or deletion</li>
            <li>Withdraw consent, where applicable</li>
          </ul>
          <p>To exercise your rights, contact: <a href="mailto:yukticare.support@gmail.com"><strong>yukticare.support@gmail.com</strong></a></p>

          <h2>2.7 Cookies &amp; Tracking</h2>
          <p>We use cookies and similar technologies to:</p>
          <ul>
            <li>Enhance functionality</li>
            <li>Analyze usage patterns</li>
            <li>Improve user experience</li>
          </ul>
          <p>Users can manage cookie preferences through browser settings.</p>

          <h2>2.8 Children's Privacy</h2>
          <p>The Platform is not intended for children under 13 without verified parental consent.</p>

          <h2>2.9 Third-Party Services</h2>
          <p>The Platform may contain links or integrations with third-party services. HealthCircle is not responsible for their privacy practices or content.</p>

          <h2>2.10 Updates to Privacy Policy</h2>
          <p>We may update this Privacy Policy periodically. Continued use of the Platform indicates acceptance of the revised policy.</p>

          <hr />

          <h2>Consent</h2>
          <p>By using HealthCircle / AskHealth AI, you acknowledge and consent to:</p>
          <ul>
            <li>The Terms of Service</li>
            <li>This Privacy Policy</li>
            <li>AI-assisted interactions and data processing</li>
          </ul>

          <h2>Contact</h2>
          <p><strong>Email:</strong> <a href="mailto:yukticare.support@gmail.com">yukticare.support@gmail.com</a><br />
            <strong>Platform:</strong> HealthCircle / AskHealth AI</p>

          <p className="!mt-8 text-sm">See also: <Link href={`${basePath}/terms`} className="text-primary hover:underline">Terms of Service</Link></p>
        </div>
      </main>
    </div>
  );
}
