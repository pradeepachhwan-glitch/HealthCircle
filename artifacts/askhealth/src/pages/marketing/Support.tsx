import { useState } from "react";
import { Link } from "wouter";
import { Mail, MessageCircle, Stethoscope, ArrowRight } from "lucide-react";
import { ContactModal, type ContactChannel } from "@/components/ContactModal";
import PageShell from "./PageShell";

const FAQ: [string, string][] = [
  ["Is HealthCircle free?", "Yes — completely free. No credit card required."],
  ["Is the AI a replacement for doctors?", "No. Yukti AI provides guidance but always recommends a doctor for serious concerns."],
  ["Is my health data private?", "Absolutely. Encrypted and never sold to third parties."],
  ["Can I ask questions in Hindi?", "Yes, Yukti AI responds in English and Hindi."],
  ["How do I become a verified doctor?", "Create an account, then use the Email or WhatsApp contact buttons above to request verification."],
  ["How quickly do doctors respond?", "Most Medical Professionals respond within 24-48 hours."],
];

export default function Support() {
  const [contactModal, setContactModal] = useState<{ open: boolean; channel: ContactChannel; topic?: string }>({
    open: false,
    channel: "email",
  });
  const openContact = (channel: ContactChannel, topic?: string) =>
    setContactModal({ open: true, channel, topic });

  return (
    <PageShell
      documentTitle="Support — HealthCircle"
      metaDescription="Reach the HealthCircle team — email support, WhatsApp partnerships and verified-doctor onboarding. We respond within 24 hours."
      eyebrow="Support"
      title={<>We're <span className="italic text-indigo-700">here to help</span>.</>}
      intro="Reach out anytime — we respond within 24 hours. For partnerships, doctor onboarding or product questions, the right channel is below."
    >
      <section className="px-4 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-5 mb-14">
          <ChannelCard
            icon={<Mail className="h-5 w-5 text-rose-700" strokeWidth={1.75} />}
            iconWrap="bg-rose-50 ring-1 ring-rose-100"
            title="Email support"
            desc="General inquiries, account help or technical issues. We reply within 24 hours."
            cta="Contact via email"
            onClick={() => openContact("email", "Support Request")}
          />
          <ChannelCard
            icon={<MessageCircle className="h-5 w-5 text-emerald-700" strokeWidth={1.75} />}
            iconWrap="bg-emerald-50 ring-1 ring-emerald-100"
            title="WhatsApp & partnerships"
            desc="Chat with us on WhatsApp — hospitals, clinics, health brands or anyone with a question."
            cta="Message us on WhatsApp"
            onClick={() => openContact("whatsapp", "Partnership Enquiry")}
          />
          <ChannelCard
            icon={<Stethoscope className="h-5 w-5 text-indigo-700" strokeWidth={1.75} />}
            iconWrap="bg-indigo-50 ring-1 ring-indigo-100"
            title="Doctor onboarding"
            desc="Join as a verified medical professional and help thousands of patients across India."
            cta="Create an account"
            href="/sign-in"
            secondary={{
              label: "Or WhatsApp us to get verified",
              onClick: () => openContact("whatsapp", "Doctor Onboarding"),
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto rounded-3xl bg-slate-50/80 border border-slate-200 p-8 md:p-12">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-3">FAQ</p>
            <h2 className="font-serif text-3xl md:text-[40px] leading-tight tracking-[-0.015em] text-slate-900">
              Frequently asked questions
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {FAQ.map(([q, a]) => (
              <div key={q} className="bg-white rounded-2xl p-5 border border-slate-200">
                <p className="font-semibold text-slate-900 text-[15px] mb-1.5">{q}</p>
                <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ContactModal
        open={contactModal.open}
        onOpenChange={(open) => setContactModal((s) => ({ ...s, open }))}
        channel={contactModal.channel}
        topic={contactModal.topic}
      />
    </PageShell>
  );
}

interface ChannelCardProps {
  icon: React.ReactNode;
  iconWrap: string;
  title: string;
  desc: string;
  cta: string;
  href?: string;
  onClick?: () => void;
  secondary?: { label: string; onClick: () => void };
}

function ChannelCard({ icon, iconWrap, title, desc, cta, href, onClick, secondary }: ChannelCardProps) {
  const ctaContent = (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 group-hover:gap-2 transition-all">
      {cta}
      <ArrowRight className="h-4 w-4" />
    </span>
  );
  return (
    <div className="group bg-white rounded-3xl p-7 md:p-8 border border-slate-200 hover:border-slate-300 hover:shadow-[0_24px_60px_-32px_rgba(15,23,42,0.18)] transition-all duration-300">
      <div className={`w-12 h-12 rounded-2xl ${iconWrap} flex items-center justify-center mb-6`}>
        {icon}
      </div>
      <h3 className="font-serif text-[22px] text-slate-900 mb-3 leading-snug">{title}</h3>
      <p className="text-[15px] text-slate-600 leading-relaxed mb-6">{desc}</p>
      {href ? (
        <Link href={href}>{ctaContent}</Link>
      ) : (
        <button type="button" onClick={onClick} className="text-left">
          {ctaContent}
        </button>
      )}
      {secondary && (
        <button
          type="button"
          onClick={secondary.onClick}
          className="block mt-3 text-xs font-medium text-emerald-700 hover:underline underline-offset-2"
        >
          {secondary.label}
        </button>
      )}
    </div>
  );
}
