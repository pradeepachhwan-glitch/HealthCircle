import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`${basePath}/`}>
            <div className="inline-flex items-center gap-2 cursor-pointer">
              <img
                src={`${basePath}/icon-192.png`}
                alt="HealthCircle"
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg"
              />
              <span className="font-bold text-slate-900">HealthCircle</span>
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
          <h2 className="!mt-2 !text-xl text-slate-700">Terms of Service</h2>
          <p className="text-sm text-slate-500"><strong>Effective Date:</strong> April 27, 2026</p>

          <h2>1.1 Acceptance of Terms</h2>
          <p>By accessing or using HealthCircle / AskHealth AI ("Platform"), you agree to comply with and be bound by these Terms of Service. If you do not agree, please refrain from using the Platform.</p>

          <h2>1.2 Nature of Service</h2>
          <p>HealthCircle is a digital health community and AI-enabled platform designed to provide:</p>
          <ul>
            <li>General health and wellness information</li>
            <li>AI-assisted responses to user queries</li>
            <li>Community-based discussions and peer support</li>
          </ul>
          <p><strong>Disclaimer:</strong> The Platform does not provide medical advice, diagnosis, or treatment. Information provided is for educational purposes only and should not replace consultation with a qualified healthcare professional.</p>

          <h2>1.3 User Eligibility</h2>
          <p>To use the Platform, you must:</p>
          <ul>
            <li>Be at least 18 years of age, or</li>
            <li>Access the Platform under the supervision of a parent or legal guardian</li>
          </ul>

          <h2>1.4 User Responsibilities</h2>
          <p>By using the Platform, you agree to:</p>
          <ul>
            <li>Provide accurate and truthful information</li>
            <li>Use the Platform in a lawful and ethical manner</li>
            <li>Respect the privacy and rights of other users</li>
            <li>Avoid sharing sensitive health information of others without consent</li>
          </ul>
          <p>You must not:</p>
          <ul>
            <li>Post misleading, harmful, or illegal content</li>
            <li>Attempt to misuse, hack, or disrupt the Platform</li>
          </ul>

          <h2>1.5 AI Disclaimer</h2>
          <ul>
            <li>AskHealth AI provides automated, informational responses only</li>
            <li>Outputs may not always be accurate, complete, or up to date</li>
            <li>Users should not rely solely on AI-generated information for medical decisions</li>
          </ul>

          <h2>1.6 Community Guidelines</h2>
          <p>Users are expected to maintain respectful engagement. The following are prohibited:</p>
          <ul>
            <li>Harassment, abuse, or discrimination</li>
            <li>Promotion of unsafe medical practices or misinformation</li>
            <li>Unauthorized advertising or spam</li>
          </ul>
          <p>HealthCircle reserves the right to remove content or suspend accounts that violate these guidelines.</p>

          <h2>1.7 Intellectual Property</h2>
          <ul>
            <li>All Platform content, including design, branding, and AI systems, is owned by HealthCircle</li>
            <li>Users retain ownership of their submissions but grant HealthCircle a non-exclusive, worldwide license to use, display, and improve services</li>
          </ul>

          <h2>1.8 Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, HealthCircle shall not be liable for:</p>
          <ul>
            <li>Any medical or health-related decisions made based on Platform content</li>
            <li>Errors or omissions in AI-generated responses</li>
            <li>Any indirect, incidental, or consequential damages arising from use of the Platform</li>
          </ul>

          <h2>1.9 Suspension &amp; Termination</h2>
          <p>HealthCircle may suspend or terminate user access if:</p>
          <ul>
            <li>These Terms are violated</li>
            <li>There is misuse, abuse, or security risk</li>
          </ul>

          <h2>1.10 Changes to Terms</h2>
          <p>HealthCircle reserves the right to update these Terms at any time. Continued use of the Platform constitutes acceptance of revised Terms.</p>

          <hr />

          <h2>Contact</h2>
          <p>For any questions, concerns, or requests:<br />
            <strong>Email:</strong> <a href="mailto:yukticare.support@gmail.com">yukticare.support@gmail.com</a><br />
            <strong>Platform:</strong> HealthCircle / AskHealth AI</p>

          <p className="!mt-8 text-sm">See also: <Link href={`${basePath}/privacy`} className="text-primary hover:underline">Privacy Policy</Link></p>
        </div>
      </main>
    </div>
  );
}
