import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Pill,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Brain,
  Stethoscope,
  Calendar,
  Users,
  Download,
  Star,
  ArrowRight,
  ClipboardList,
  Activity,
} from "lucide-react";

interface SummaryData {
  consultation: {
    id: number;
    type: string;
    status: string;
    chiefComplaint: string | null;
    createdAt: string;
    endedAt: string | null;
    diagnosis: string | null;
    notes: string | null;
    followUpInstructions: string | null;
    consultationFee: string | null;
  };
  triageSession: {
    id: number;
    summary: string | null;
    riskLevel: string | null;
  } | null;
  doctor: {
    name: string;
    specialty: string;
    rating: string;
  } | null;
  prescription: {
    id: number;
    medicationsJson: string | null;
    instructions: string | null;
    icdCodes: string | null;
    followUpDate: string | null;
    redFlags: string | null;
  } | null;
}

const RECOMMENDED_CIRCLES: Record<string, { slug: string; name: string; emoji: string }> = {
  "Cardiologist": { slug: "heart-health", name: "Heart Circle", emoji: "❤️" },
  "Endocrinologist": { slug: "diabetes-care", name: "Sugar Care", emoji: "🩸" },
  "Gynecologist": { slug: "pregnancy-motherhood", name: "Mom Journey", emoji: "🌸" },
  "Neurologist": { slug: "mental-wellness", name: "Mind Space", emoji: "🧠" },
  "General Physician": { slug: "weight-loss-fitness", name: "Fit Life", emoji: "💪" },
  "Pulmonologist": { slug: "weight-loss-fitness", name: "Fit Life", emoji: "🫁" },
};

export default function TeleconsultSummary() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tc/consultation/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!data) return null;
  const { consultation, triageSession, doctor, prescription } = data;
  const triageParsed = triageSession?.summary
    ? (() => { try { return JSON.parse(triageSession.summary); } catch { return null; } })()
    : null;
  const medications: { name: string; dose: string; freq: string }[] = prescription?.medicationsJson
    ? (() => { try { return JSON.parse(prescription.medicationsJson); } catch { return []; } })()
    : [];
  const redFlags: string[] = prescription?.redFlags
    ? (() => { try { return JSON.parse(prescription.redFlags); } catch { return []; } })()
    : [];
  const circle = doctor ? RECOMMENDED_CIRCLES[doctor.specialty] : null;

  const handlePrint = () => window.print();

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 print:max-w-full print:p-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-xl">Consultation Summary</h1>
              <p className="text-xs text-slate-500">Reference #{id}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="w-4 h-4 mr-1.5" /> Save / Print
          </Button>
        </div>

        {/* Doctor + Date */}
        {doctor && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-200 flex items-center justify-center text-xl">
                  🩺
                </div>
                <div>
                  <p className="font-bold text-slate-800">{doctor.name}</p>
                  <p className="text-xs text-slate-500">{doctor.specialty}</p>
                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    {Number(doctor.rating).toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="text-right text-xs">
                <p className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(consultation.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
                <p className="text-slate-400 mt-1 capitalize">{consultation.type} consultation</p>
              </div>
            </div>
          </div>
        )}

        {/* Diagnosis (patient-friendly) */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" /> Diagnosis
          </p>
          <p className="text-slate-800 font-medium">
            {consultation.diagnosis ?? "Diagnosis pending — your doctor will update this soon."}
          </p>
          {consultation.chiefComplaint && (
            <p className="text-xs text-blue-600 mt-3">
              <span className="font-semibold">Chief complaint:</span> {consultation.chiefComplaint}
            </p>
          )}
        </div>

        {/* Yukti Triage Recap */}
        {triageParsed && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Yukti AI Pre-Consult Summary
              </p>
              <Badge className="bg-violet-100 text-violet-700">{triageParsed.riskLevel ?? "—"}</Badge>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{triageParsed.summary}</p>
          </div>
        )}

        {/* Prescription */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Pill className="w-3.5 h-3.5" /> Prescription
          </p>
          {!prescription ? (
            <p className="text-sm text-slate-400">No prescription was issued for this consultation.</p>
          ) : (
            <div className="space-y-4">
              {medications.length > 0 ? (
                <div className="space-y-2">
                  {medications.map((m, i) => (
                    <div key={i} className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Pill className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.dose} · {m.freq}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No medications prescribed.</p>
              )}
              {prescription.instructions && (
                <div>
                  <p className="text-xs font-semibold text-slate-600 mb-1">Instructions</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{prescription.instructions}</p>
                </div>
              )}
              {prescription.icdCodes && (
                <div className="text-xs text-slate-500">
                  <span className="font-semibold">ICD-10:</span> {prescription.icdCodes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Follow-up + Care Plan */}
        {(consultation.followUpInstructions || prescription?.followUpDate) && (
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Follow-up Care Plan
            </p>
            {prescription?.followUpDate && (
              <div className="flex items-center gap-2 text-sm text-slate-700 mb-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Next visit: <span className="font-semibold">{prescription.followUpDate}</span></span>
              </div>
            )}
            {consultation.followUpInstructions && (
              <p className="text-sm text-slate-700 leading-relaxed">{consultation.followUpInstructions}</p>
            )}
          </div>
        )}

        {/* Red Flags / Warning Signs */}
        {redFlags.length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Warning Signs — Seek Care if You Notice
            </p>
            <ul className="space-y-1.5">
              {redFlags.map((f, i) => (
                <li key={i} className="text-sm text-red-700 flex gap-2">
                  <Activity className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Continuity care — Circle suggestion */}
        {circle && (
          <Link href={`/communities/${circle.slug}`}>
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                  {circle.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Continuity Care</p>
                  <p className="font-bold text-slate-800">Join {circle.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Stay connected with people on the same journey · Track progress · Ask follow-up questions
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
              </div>
            </div>
          </Link>
        )}

        {/* Footer disclaimer */}
        <p className="text-xs text-center text-slate-400 px-4 leading-relaxed">
          This summary is a record of your tele-consultation. For emergencies, dial 108 or visit the nearest hospital.
          Always follow your doctor's specific instructions.
        </p>

        <div className="flex gap-3 print:hidden">
          <Button variant="outline" className="flex-1" onClick={() => navigate("/teleconsult")}>
            <FileText className="w-4 h-4 mr-1.5" /> All Consultations
          </Button>
          <Button className="flex-1" onClick={() => navigate("/teleconsult/triage")}>
            <Brain className="w-4 h-4 mr-1.5" /> New Triage
          </Button>
        </div>
      </div>
    </Layout>
  );
}
