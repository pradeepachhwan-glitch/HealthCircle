import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  MessageSquare,
  Send,
  FileText,
  Brain,
  AlertTriangle,
  Loader2,
  Clock,
  X,
  Pill,
  ClipboardList,
  ChevronRight,
  Activity,
  Star,
  MapPin,
  Headphones,
  Copy,
  Check,
} from "lucide-react";

interface ConsultationData {
  consultation: {
    id: number;
    type: string;
    status: string;
    chiefComplaint: string | null;
    consentGiven: string;
    createdAt: string;
    startedAt: string | null;
    diagnosis: string | null;
    notes: string | null;
    followUpInstructions: string | null;
    consultationFee: string | null;
  };
  triageSession: {
    id: number;
    chiefComplaint: string;
    summary: string | null;
    riskLevel: string | null;
    suggestedSpecialty: string | null;
  } | null;
  doctor: {
    id: number;
    name: string;
    specialty: string;
    rating: string;
    location: string;
    experienceYears: number;
  } | null;
  messages: {
    id: number;
    message: string;
    senderRole: string;
    createdAt: string;
  }[];
  prescription: {
    id: number;
    medicationsJson: string | null;
    instructions: string | null;
    icdCodes: string | null;
    followUpDate: string | null;
    redFlags: string | null;
  } | null;
  googleMeetUrl?: string;
}

type TabType = "triage" | "chat" | "prescription";

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-blue-100 text-blue-700",
  in_progress: "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-600",
};

const RISK_CONFIG = {
  LOW: { color: "text-green-700", bg: "bg-green-50", badge: "bg-green-100 text-green-700" },
  MEDIUM: { color: "text-amber-700", bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700" },
  HIGH: { color: "text-red-700", bg: "bg-red-50", badge: "bg-red-100 text-red-700" },
};

export default function TeleconsultSession() {
  const { id } = useParams<{ id: string }>();
  const consultationId = useMemo(() => {
    const n = Number(id);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [id]);
  const [, navigate] = useLocation();
  const [data, setData] = useState<ConsultationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("triage");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/tc/consultation/${id}`, { credentials: "include" });
      if (!res.ok) { navigate("/teleconsult"); return; }
      const d = await res.json();
      setData(d);
    } catch {
      navigate("/teleconsult");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const combinedMessages = useMemo(() => {
    return (data?.messages ?? []).map((m) => ({
      key: `r-${m.id}`,
      from: m.senderRole === "patient" ? "self" : "remote",
      text: m.message,
      ts: new Date(m.createdAt).getTime(),
    })).sort((a, b) => a.ts - b.ts);
  }, [data]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [combinedMessages.length]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await fetch(`/api/tc/consultation/${id}/start`, { method: "POST", credentials: "include" });
      await fetchData();
    } finally {
      setStarting(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Mark this consultation as completed?")) return;
    await fetch(`/api/tc/consultation/${id}/close`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnosis: data?.consultation.diagnosis }),
    });
    navigate(`/teleconsult/summary/${id}`);
  };

  const handleSendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      await fetch("/api/tc/message", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultationId: consultationId, message: text }),
      });
      setMessage("");
      await fetchData();
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  };

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
  const triageParsed = triageSession?.summary ? (() => { try { return JSON.parse(triageSession.summary); } catch { return null; } })() : null;
  const riskCfg = triageParsed?.riskLevel ? RISK_CONFIG[triageParsed.riskLevel as keyof typeof RISK_CONFIG] : null;
  const medications: { name: string; dose: string; freq: string }[] = prescription?.medicationsJson
    ? (() => { try { return JSON.parse(prescription.medicationsJson); } catch { return []; } })()
    : [];

  const isMediaCall = consultation.type === "video" || consultation.type === "audio";

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              {consultation.type === "video" ? (
                <Video className="w-5 h-5 text-primary" />
              ) : consultation.type === "audio" ? (
                <Headphones className="w-5 h-5 text-primary" />
              ) : (
                <MessageSquare className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h1 className="font-bold text-slate-800">Consultation #{id}</h1>
              <p className="text-xs text-slate-500">
                {new Date(consultation.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {consultation.consultationFee && ` · ₹${Number(consultation.consultationFee).toLocaleString("en-IN")}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[consultation.status] ?? "bg-slate-100 text-slate-600"}>
              {consultation.status.replace("_", " ")}
            </Badge>
            {consultation.status === "booked" && (
              <Button size="sm" onClick={handleStart} disabled={starting}>
                {starting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Video className="w-4 h-4 mr-1.5" />}
                Start Session
              </Button>
            )}
            {consultation.status === "in_progress" && (
              <Button size="sm" variant="outline" onClick={handleClose} className="text-red-600 border-red-200 hover:bg-red-50">
                <X className="w-4 h-4 mr-1.5" /> End Session
              </Button>
            )}
            {consultation.status === "completed" && (
              <Button size="sm" onClick={() => navigate(`/teleconsult/summary/${id}`)}>
                <FileText className="w-4 h-4 mr-1.5" /> View Summary
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-5">
          {/* LEFT — Clinical panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Doctor card */}
            {doctor && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Your Doctor</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-200 flex items-center justify-center text-xl font-bold">
                    🩺
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{doctor.name}</p>
                    <p className="text-xs text-slate-500">{doctor.specialty}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {Number(doctor.rating).toFixed(1)}
                      </span>
                      <span>{doctor.experienceYears} yrs</span>
                      {doctor.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />{doctor.location.split(",")[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Triage summary */}
            {triageParsed && riskCfg && (
              <div className={`rounded-2xl border p-4 ${riskCfg.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" /> Yukti Triage Summary
                  </p>
                  <Badge className={riskCfg.badge}>{triageParsed.riskLevel}</Badge>
                </div>
                <p className={`text-sm ${riskCfg.color} mb-2`}>{triageParsed.urgencyMessage}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{triageParsed.summary}</p>
                {triageParsed.keyFindings?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-600 mb-1">Key Findings</p>
                    <ul className="space-y-0.5">
                      {triageParsed.keyFindings.map((f: string, i: number) => (
                        <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                          <Activity className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />{f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Interaction panel */}
          <div className="lg:col-span-3 flex flex-col">
            {/* Tab bar */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
              {([
                { id: "triage" as TabType, icon: Brain, label: "Yukti AI" },
                { id: "chat" as TabType, icon: MessageSquare, label: "Chat" },
                { id: "prescription" as TabType, icon: Pill, label: "Prescription" },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Live call area — focusing on Google Meet */}
            {isMediaCall && activeTab === "triage" && (
              <div className="rounded-2xl bg-slate-900 mb-4 overflow-hidden border border-slate-800 shadow-2xl shadow-black/40">
                {consultation.status === "booked" && (
                  <div className="aspect-video flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-800 to-slate-900 px-6 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-2">
                      <Video className="w-8 h-8 text-white/30" />
                    </div>
                    <div>
                      <p className="text-white/80 font-semibold text-lg">Consultation Not Started</p>
                      <p className="text-white/40 text-sm mt-2 max-w-xs mx-auto">
                        Once the doctor starts the session, you will be able to join via Google Meet.
                      </p>
                    </div>
                  </div>
                )}

                {consultation.status === "completed" && (
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-900 px-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-2 border border-emerald-500/20">
                      <ClipboardList className="w-8 h-8 text-emerald-400" />
                    </div>
                    <p className="text-white/80 font-bold text-xl">Consultation Completed</p>
                    <p className="text-white/40 text-sm max-w-xs">
                      This session has ended. Review the diagnosis and summary in the sidebar.
                    </p>
                  </div>
                )}

                {consultation.status === "in_progress" && (
                  <div className="aspect-video flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-800 to-slate-950 px-8 text-center relative overflow-hidden">
                    {data.googleMeetUrl ? (
                      <>
                        <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center relative z-10">
                          <Video className="w-12 h-12 text-primary" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                             <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          </div>
                        </div>
                        <div className="relative z-10">
                          <h3 className="text-white font-bold text-2xl mb-2">Google Meet Ready</h3>
                          <p className="text-white/50 text-sm max-w-sm mx-auto mb-8">
                            Your secure consultation is being hosted on Google Meet. Click below to launch the video call.
                          </p>
                          <Button
                            size="lg"
                            onClick={() => window.open(data.googleMeetUrl, "_blank")}
                            className="bg-primary hover:bg-primary/90 text-white px-10 py-7 text-xl font-bold shadow-2xl shadow-primary/30 rounded-2xl hover:scale-[1.02] transition-all"
                          >
                            <Video className="w-7 h-7 mr-3" /> Join Now
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 rounded-3xl bg-amber-500/10 flex items-center justify-center relative z-10 border border-amber-500/20">
                          <AlertTriangle className="w-10 h-10 text-amber-400" />
                        </div>
                        <div className="relative z-10">
                          <h3 className="text-white font-bold text-xl mb-2">Connecting...</h3>
                          <p className="text-white/50 text-sm max-w-sm mx-auto mb-4">
                            Waiting for the doctor to generate the meeting link. This usually takes a few seconds.
                          </p>
                          <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab content */}
            {activeTab === "triage" && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-sm font-semibold text-slate-700 mb-3">Chief Complaint</p>
                <p className="text-sm text-slate-600 mb-4">
                  {consultation.chiefComplaint ?? triageSession?.chiefComplaint ?? "Not specified"}
                </p>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="flex flex-col rounded-2xl border border-slate-100 bg-white overflow-hidden" style={{ height: 420 }}>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {combinedMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <MessageSquare className="w-8 h-8 text-slate-200" />
                      <p className="text-slate-400 text-sm">No messages yet</p>
                      <p className="text-xs text-slate-300">Send a message to your doctor</p>
                    </div>
                  ) : (
                    combinedMessages.map((m) => (
                      <div
                        key={m.key}
                        className={`flex ${m.from === "self" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                            m.from === "self"
                              ? "bg-primary text-white rounded-br-md"
                              : "bg-slate-100 text-slate-800 rounded-bl-md"
                          }`}
                        >
                          {m.text}
                          <p className={`text-[10px] mt-1 ${m.from === "self" ? "text-white/60" : "text-slate-400"}`}>
                            {new Date(m.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-slate-100 p-3 flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    placeholder="Type a message…"
                    disabled={consultation.status === "completed"}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <Button
                    size="icon"
                    disabled={!message.trim() || sending || consultation.status === "completed"}
                    onClick={handleSendMessage}
                    className="rounded-xl h-10 w-10"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
