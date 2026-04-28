import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Stethoscope,
  Activity,
  Info,
} from "lucide-react";

const STEPS = ["Complaint", "Symptoms", "History", "Review"];

const SYMPTOM_OPTIONS = [
  "Fever", "Headache", "Cough", "Shortness of breath", "Chest pain",
  "Fatigue", "Nausea", "Vomiting", "Abdominal pain", "Back pain",
  "Joint pain", "Skin rash", "Dizziness", "Palpitations", "Swelling",
  "Loss of appetite", "Insomnia", "Anxiety", "Depression", "Weight loss",
];

const SPECIALTY_ICONS: Record<string, string> = {
  "General Physician": "🩺",
  "Cardiologist": "❤️",
  "Neurologist": "🧠",
  "Orthopedic Surgeon": "🦴",
  "Dermatologist": "🌿",
  "Pulmonologist": "🫁",
  "Gynecologist": "🌸",
  "Endocrinologist": "🔬",
};

interface TriageResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskReason: string;
  summary: string;
  suggestedSpecialty: string;
  suggestedConsultType: "video" | "async";
  keyFindings: string[];
  urgencyMessage: string;
  redFlags: string[];
}

const RISK_CONFIG = {
  LOW: { color: "text-green-700", bg: "bg-green-50", border: "border-green-200", badge: "bg-green-100 text-green-700", icon: CheckCircle2, label: "Low Risk" },
  MEDIUM: { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", icon: Activity, label: "Medium Risk" },
  HIGH: { color: "text-red-700", bg: "bg-red-50", border: "border-red-200", badge: "bg-red-100 text-red-700", icon: AlertTriangle, label: "High Risk" },
};

export default function TeleconsultTriage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState(5);
  const [medicalHistory, setMedicalHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ triageSession: { id: number }; parsed: TriageResult } | null>(null);
  const [error, setError] = useState("");

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );

  const canNext = () => {
    if (step === 0) return chiefComplaint.trim().length >= 5;
    if (step === 1) return selectedSymptoms.length > 0 && duration;
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tc/triage/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint,
          symptoms: selectedSymptoms,
          duration,
          severity,
          medicalHistory: medicalHistory || undefined,
          medications: medications || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Triage failed");
      const data = await res.json();
      setResult(data);
      setStep(4);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleBookFromTriage = () => {
    if (!result) return;
    navigate(
      `/teleconsult/doctors?triageId=${result.triageSession.id}&specialty=${encodeURIComponent(result.parsed.suggestedSpecialty)}&type=${result.parsed.suggestedConsultType}`,
    );
  };

  const riskCfg = result ? RISK_CONFIG[result.parsed.riskLevel] : null;

  return (
    <Layout>
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-xl">Yukti AI Triage</h1>
            <p className="text-xs text-slate-500">Pre-consultation symptom assessment</p>
          </div>
        </div>

        {/* Progress (hide on result step) */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex items-center gap-1 mb-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`h-1.5 w-full rounded-full transition-all ${
                      i <= step ? "bg-primary" : "bg-slate-100"
                    }`}
                  />
                  <span className={`text-[10px] font-medium ${i === step ? "text-primary" : "text-slate-400"}`}>
                    {s}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 0 — Chief Complaint */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                What is your main concern today?
              </label>
              <textarea
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={4}
                placeholder="e.g. I have had a persistent headache for 3 days along with mild fever and neck stiffness…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
              <p className="text-xs text-slate-400 mt-1.5">{chiefComplaint.length}/500 characters</p>
            </div>
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                Be as specific as possible. Yukti uses your description to generate a clinical
                snapshot for your doctor before the consultation begins.
              </p>
            </div>
          </div>
        )}

        {/* Step 1 — Symptoms */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Select all symptoms you have
              </label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSymptom(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedSymptoms.includes(s)
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                How long have you had these symptoms?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["< 1 day", "1–3 days", "3–7 days", "1–2 weeks", "2–4 weeks", "> 1 month"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                      duration === d
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:border-primary/40"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Severity: <span className="text-primary">{severity}/10</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={severity}
                onChange={(e) => setSeverity(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — History */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Relevant medical history
              </label>
              <textarea
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                rows={3}
                placeholder="e.g. Hypertension (diagnosed 2019), Type 2 Diabetes, no surgeries"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Current medications
              </label>
              <textarea
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                rows={2}
                placeholder="e.g. Metformin 500mg twice daily, Amlodipine 5mg once daily"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-slate-700 mb-1">Review your answers</p>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 flex-shrink-0">Chief complaint</span>
                <span className="text-slate-800 font-medium">{chiefComplaint}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 flex-shrink-0">Symptoms</span>
                <span className="text-slate-800 font-medium">{selectedSymptoms.join(", ") || "None selected"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 flex-shrink-0">Duration</span>
                <span className="text-slate-800 font-medium">{duration || "—"}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-28 flex-shrink-0">Severity</span>
                <span className="text-slate-800 font-medium">{severity}/10</span>
              </div>
              {medicalHistory && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-28 flex-shrink-0">History</span>
                  <span className="text-slate-800 font-medium">{medicalHistory}</span>
                </div>
              )}
              {medications && (
                <div className="flex gap-2">
                  <span className="text-slate-500 w-28 flex-shrink-0">Medications</span>
                  <span className="text-slate-800 font-medium">{medications}</span>
                </div>
              )}
            </div>
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Result */}
        {step === 4 && result && riskCfg && (
          <div className="space-y-5">
            <div className={`rounded-2xl border ${riskCfg.border} ${riskCfg.bg} p-6`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <riskCfg.icon className={`w-6 h-6 ${riskCfg.color}`} />
                  <span className={`font-bold text-lg ${riskCfg.color}`}>{riskCfg.label}</span>
                </div>
                <Badge className={riskCfg.badge}>{result.parsed.riskLevel}</Badge>
              </div>
              <p className={`text-sm ${riskCfg.color} mb-3`}>{result.parsed.urgencyMessage}</p>
              <p className="text-slate-700 text-sm leading-relaxed">{result.parsed.summary}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Suggested Specialist</span>
                <span className="font-bold text-primary">
                  {SPECIALTY_ICONS[result.parsed.suggestedSpecialty] ?? "🩺"} {result.parsed.suggestedSpecialty}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Consultation Type</span>
                <Badge className="bg-primary/10 text-primary">
                  {result.parsed.suggestedConsultType === "video" ? "📹 Video" : "💬 Async Chat"}
                </Badge>
              </div>
              {result.parsed.keyFindings.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-slate-700 block mb-2">Key Findings</span>
                  <ul className="space-y-1">
                    {result.parsed.keyFindings.map((f, i) => (
                      <li key={i} className="text-sm text-slate-600 flex gap-2">
                        <span className="text-primary font-bold">·</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.parsed.redFlags.length > 0 && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Red Flags
                  </p>
                  <ul className="space-y-0.5">
                    {result.parsed.redFlags.map((f, i) => (
                      <li key={i} className="text-xs text-red-600">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button className="w-full h-12 text-base font-semibold" onClick={handleBookFromTriage}>
              <Stethoscope className="w-4 h-4 mr-2" />
              Book Consultation with {result.parsed.suggestedSpecialty}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <p className="text-xs text-center text-slate-400">
              This triage is for guidance only and does not replace professional medical advice.
            </p>
          </div>
        )}

        {/* Navigation */}
        {step < 4 && (
          <div className="flex items-center justify-between mt-8">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            ) : (
              <div />
            )}
            {step < 3 ? (
              <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button disabled={loading} onClick={handleSubmit}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analysing…
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" /> Run AI Triage
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
