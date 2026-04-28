import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Brain,
  Video,
  MessageSquare,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Clock,
  Star,
  ArrowRight,
  Activity,
  Shield,
  Zap,
} from "lucide-react";

interface Consultation {
  id: number;
  type: string;
  status: string;
  chiefComplaint: string | null;
  createdAt: string;
  consultationFee: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function TeleconsultDashboard() {
  const [, navigate] = useLocation();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tc/consultations", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setConsultations(d.consultations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/90 to-blue-700 text-white p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Tele-Consulting</h1>
              <p className="text-blue-100 text-sm">Powered by Yukti AI</p>
            </div>
          </div>
          <p className="text-blue-50 text-sm mb-6 max-w-md">
            Connect with verified doctors online. Yukti analyses your symptoms first so
            every consultation starts with a full clinical picture.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => navigate("/teleconsult/triage")}
              className="bg-white text-primary hover:bg-blue-50 font-semibold shadow"
            >
              <Brain className="w-4 h-4 mr-2" />
              Start AI Triage
            </Button>
            <Button
              onClick={() => navigate("/teleconsult/doctors")}
              variant="outline"
              className="border-white/40 text-white hover:bg-white/15"
            >
              <Stethoscope className="w-4 h-4 mr-2" />
              Browse Doctors
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              icon: Brain,
              label: "Yukti Triage",
              sub: "AI pre-consult",
              href: "/teleconsult/triage",
              color: "text-violet-600",
              bg: "bg-violet-50",
            },
            {
              icon: Stethoscope,
              label: "Find Doctors",
              sub: "All specialties",
              href: "/teleconsult/doctors",
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              icon: Video,
              label: "Video Consult",
              sub: "Face-to-face",
              href: "/teleconsult/doctors",
              color: "text-green-600",
              bg: "bg-green-50",
            },
            {
              icon: AlertTriangle,
              label: "Emergency",
              sub: "Urgent care",
              href: "/teleconsult/triage",
              color: "text-red-600",
              bg: "bg-red-50",
            },
          ].map((item) => (
            <Link key={item.label} href={item.href}>
              <div className="rounded-xl border border-slate-100 bg-white p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-3`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <p className="font-semibold text-sm text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* How it Works */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6">
          <h2 className="font-bold text-slate-800 mb-4">How it works</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { icon: Brain, step: "1", label: "AI Triage", desc: "Yukti analyses your symptoms in 2 minutes" },
              { icon: Stethoscope, step: "2", label: "Match Doctor", desc: "Get matched to the right specialist" },
              { icon: Video, step: "3", label: "Consult", desc: "Video or async chat consultation" },
              { icon: Activity, step: "4", label: "Follow-up", desc: "Prescription, care plan & circle enrolment" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg mb-2">
                  {s.step}
                </div>
                <p className="font-semibold text-sm text-slate-800">{s.label}</p>
                <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-4 justify-center">
          {[
            { icon: Shield, label: "HIPAA-ready encryption" },
            { icon: Star, label: "Verified doctors only" },
            { icon: Zap, label: "Reports in 30 min" },
            { icon: Clock, label: "4-hour async SLA" },
          ].map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-full px-4 py-2">
              <b.icon className="w-3.5 h-3.5 text-primary" />
              {b.label}
            </div>
          ))}
        </div>

        {/* My Consultations */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">My Consultations</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : consultations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No consultations yet</p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => navigate("/teleconsult/triage")}
              >
                Start your first triage
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {consultations.map((c) => (
                <Link key={c.id} href={`/teleconsult/session/${c.id}`}>
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        {c.type === "video" ? (
                          <Video className="w-5 h-5 text-primary" />
                        ) : (
                          <MessageSquare className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-slate-800">
                          {c.chiefComplaint ?? "General Consultation"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(c.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {c.consultationFee && (
                            <> · ₹{Number(c.consultationFee).toLocaleString("en-IN")}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[c.status] ?? "bg-slate-100 text-slate-600"}>
                        {c.status.replace("_", " ")}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
