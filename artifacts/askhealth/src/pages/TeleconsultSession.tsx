import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTeleconsultCall, type CallMode } from "@/hooks/useTeleconsultCall";
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
  Stethoscope,
  ShieldCheck,
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
  viewerRole: "patient" | "doctor";
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
    createdAt: string;
  } | null;
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

function VideoTile({ stream, label, muted, isSelf, hidden }: { stream: MediaStream | null; label: string; muted?: boolean; isSelf?: boolean; hidden?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  const hasVideo = !!stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  const hasAudio = !!stream && stream.getAudioTracks().some((t) => t.enabled);

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 ${hidden ? "hidden" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`w-full h-full object-cover ${isSelf ? "scale-x-[-1]" : ""}`}
      />
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-900">
          <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center">
            {hasAudio ? <Mic className="w-6 h-6 text-emerald-400" /> : <VideoOff className="w-6 h-6 text-white/60" />}
          </div>
          <p className="text-xs text-white/70">{hasAudio ? "Audio only" : "Camera off"}</p>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-[11px] font-medium backdrop-blur-sm flex items-center gap-1.5">
        {label}
        {!hasAudio && <MicOff className="w-3 h-3 text-red-400" />}
      </div>
    </div>
  );
}

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
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({
    icdCodes: "",
    instructions: "",
    medications: [] as { name: string; dose: string; freq: string }[],
  });

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/tc/consultation/${id}`, { credentials: "include" });
      if (!res.ok) { navigate("/teleconsult"); return; }
      const d = await res.json();
      setData(d);
      if (d.prescription) {
        setPrescriptionForm({
          icdCodes: d.prescription.icdCodes || "",
          instructions: d.prescription.instructions || "",
          medications: d.prescription.medicationsJson ? JSON.parse(d.prescription.medicationsJson) : [],
        });
      }
    } catch {
      navigate("/teleconsult");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrescription = async () => {
    setSavingPrescription(true);
    try {
      await fetch("/api/tc/prescription/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultationId,
          ...prescriptionForm,
        }),
      });
      toast.success("Prescription saved");
      await fetchData();
    } catch {
      toast.error("Failed to save prescription");
    } finally {
      setSavingPrescription(false);
    }
  };

  const addMedication = () => {
    setPrescriptionForm(prev => ({
      ...prev,
      medications: [...prev.medications, { name: "", dose: "", freq: "" }],
    }));
  };

  const updateMedication = (index: number, field: string, value: string) => {
    const newMeds = [...prescriptionForm.medications];
    (newMeds[index] as any)[field] = value;
    setPrescriptionForm(prev => ({ ...prev, medications: newMeds }));
  };

  const removeMedication = (index: number) => {
    setPrescriptionForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, [id]);

  // Decide call mode + whether to enable the WebRTC hook.
  const callMode: CallMode = useMemo(() => {
    if (!data) return "chat";
    if (data.consultation.type === "video") return "video";
    if (data.consultation.type === "audio") return "audio";
    return "chat";
  }, [data]);
  const callEnabled = !!data && data.consultation.status === "in_progress";

  const call = useTeleconsultCall(consultationId, callMode, callEnabled);

  // Combine REST messages with realtime WS chat lines for the chat tab.
  const combinedMessages = useMemo(() => {
    if (!data) return [];
    const rest = (data.messages ?? []).map((m) => ({
      key: `r-${m.id}`,
      from: m.senderRole === data.viewerRole ? "self" : "remote",
      text: m.message,
      ts: new Date(m.createdAt).getTime(),
    }));
    const live = call.chatLines
      .filter((l) => {
        return !rest.some(
          (r) => r.from === l.from && r.text === l.text && Math.abs(r.ts - l.ts) < 15_000,
        );
      })
      .map((l, i) => ({
        key: `l-${l.ts}-${i}`,
        from: l.from,
        text: l.text,
        ts: l.ts,
      }));
    return [...rest, ...live].sort((a, b) => a.ts - b.ts);
  }, [data?.messages, data?.viewerRole, call.chatLines]);

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
    call.endCall();
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
      // 1) Live broadcast over WS so the other peer sees it instantly.
      if (callEnabled) call.sendChat(text);
      // 2) Persist to DB so it survives reload.
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
  const callStatusLabel = (() => {
    switch (call.status) {
      case "requesting-media": return "Requesting camera & microphone…";
      case "media-error": return call.errorMessage ?? "Media access denied";
      case "connecting": return "Connecting to signaling…";
      case "waiting-peer": return "Waiting for the other party to join…";
      case "in-call": return "Live";
      case "ended": return "Call ended";
      case "error": return call.errorMessage ?? "Connection error";
      default: return "";
    }
  })();
  const callStatusColor = (() => {
    switch (call.status) {
      case "in-call": return "text-green-400";
      case "media-error":
      case "error": return "text-red-400";
      case "waiting-peer": return "text-amber-400";
      default: return "text-white/70";
    }
  })();

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
                {triageParsed.redFlags?.length > 0 && (
                  <div className="mt-3 rounded-lg bg-red-100/60 p-2">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3" /> Red Flags
                    </p>
                    {triageParsed.redFlags.map((f: string, i: number) => (
                      <p key={i} className="text-xs text-red-600">• {f}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Share-link card during a live call so a 2nd browser tab can join as the doctor (demo). */}
            {isMediaCall && consultation.status === "in_progress" && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Connect another device</p>
                <p className="text-xs text-emerald-700/80 leading-relaxed mb-3">
                  Open this same URL in a second browser tab or device (signed in as you) — the two will connect over a real peer-to-peer call so you can verify video & audio end-to-end.
                </p>
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                  {linkCopied ? <><Check className="w-3.5 h-3.5 mr-1.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copy session link</>}
                </Button>
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

            {/* Live call area — only when type is video/audio AND triage tab is open */}
            {isMediaCall && activeTab === "triage" && (
              <div className="rounded-2xl bg-slate-900 mb-4 overflow-hidden">
                {consultation.status === "booked" && (
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-900 px-6 text-center">
                    {consultation.type === "video" ? <Video className="w-10 h-10 text-white/40" /> : <Headphones className="w-10 h-10 text-white/40" />}
                    <div>
                      <p className="text-white/80 font-medium text-sm">Session not started</p>
                      <p className="text-white/40 text-xs mt-1">Click "Start Session" above to request camera & microphone</p>
                    </div>
                  </div>
                )}

                {consultation.status === "completed" && (
                  <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-800 to-slate-900 px-6 text-center">
                    <Video className="w-10 h-10 text-white/40" />
                    <p className="text-white/80 font-medium text-sm">Session ended</p>
                  </div>
                )}

                {consultation.status === "in_progress" && (
                  <>
                    {/* Video grid: large remote tile + small self-view */}
                    <div className="relative aspect-video bg-black">
                      {call.remotePeers.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                          {call.status === "media-error" ? (
                            <>
                              <AlertTriangle className="w-10 h-10 text-red-400" />
                              <p className="text-red-300 font-medium text-sm">Cannot access camera or microphone</p>
                              <p className="text-white/50 text-xs max-w-md">{call.errorMessage}</p>
                              <p className="text-white/40 text-[11px]">
                                Grant permission in your browser's address bar, then reload this page.
                              </p>
                            </>
                          ) : (
                            <>
                              {call.status === "in-call" || call.status === "waiting-peer" ? (
                                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                                </div>
                              ) : (
                                <Loader2 className="w-10 h-10 text-white/40 animate-spin" />
                              )}
                              <p className={`font-medium text-sm ${callStatusColor}`}>{callStatusLabel}</p>
                              {call.status === "waiting-peer" && (
                                <p className="text-white/40 text-xs max-w-sm">
                                  Once the other party joins, their video and audio will appear here.
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <VideoTile
                          stream={call.remotePeers[0]?.stream ?? null}
                          label={doctor?.name ?? "Other party"}
                          muted={false}
                        />
                      )}

                      {/* Picture-in-picture self view */}
                      {consultation.type === "video" && call.localStream && (
                        <div className="absolute bottom-3 right-3 w-32 h-24 sm:w-40 sm:h-28 rounded-xl overflow-hidden border-2 border-white/30 shadow-xl">
                          <VideoTile stream={call.localStream} label="You" muted isSelf />
                        </div>
                      )}

                      {/* Live badge */}
                      {call.status === "in-call" && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-red-600 rounded-md">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                          <span className="text-white text-[11px] font-bold uppercase tracking-wide">Live</span>
                        </div>
                      )}
                    </div>

                    {/* Call controls */}
                    <div className="flex items-center justify-center gap-3 py-3 bg-slate-950">
                      <button
                        onClick={call.toggleMic}
                        disabled={!call.localStream}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                          call.micEnabled ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-600 hover:bg-red-500 text-white"
                        } disabled:opacity-40 disabled:cursor-not-allowed`}
                        aria-label={call.micEnabled ? "Mute microphone" : "Unmute microphone"}
                        title={call.micEnabled ? "Mute microphone" : "Unmute microphone"}
                      >
                        {call.micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                      </button>
                      {consultation.type === "video" && (
                        <button
                          onClick={call.toggleCam}
                          disabled={!call.localStream}
                          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
                            call.camEnabled ? "bg-slate-700 hover:bg-slate-600 text-white" : "bg-red-600 hover:bg-red-500 text-white"
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                          aria-label={call.camEnabled ? "Turn camera off" : "Turn camera on"}
                          title={call.camEnabled ? "Turn camera off" : "Turn camera on"}
                        >
                          {call.camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                        </button>
                      )}
                      <button
                        onClick={handleClose}
                        className="w-11 h-11 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white transition-colors"
                        aria-label="End call"
                        title="End call"
                      >
                        <PhoneOff className="w-5 h-5" />
                      </button>
                    </div>
                  </>
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
                {!triageSession && (
                  <div className="rounded-xl bg-violet-50 border border-violet-100 p-4 flex gap-3">
                    <Brain className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-violet-700 mb-1">No AI Triage on file</p>
                      <p className="text-xs text-violet-600">
                        Running Yukti triage before your consultation helps your doctor prepare better.
                      </p>
                      <Button size="sm" variant="link" className="text-violet-700 p-0 h-auto mt-1 text-xs" onClick={() => navigate("/teleconsult/triage")}>
                        Run triage now <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
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

            {activeTab === "prescription" && (
              <div className="space-y-6">
                {data.viewerRole === "doctor" && (
                  <Card className="border-emerald-100 shadow-sm">
                    <CardHeader className="pb-3 bg-emerald-50/30">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800 uppercase tracking-wider">
                        <Stethoscope className="w-4 h-4" />
                        Clinical Prescription Pad
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Diagnosis / ICD-10 Code</label>
                        <Input 
                          value={prescriptionForm.icdCodes} 
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrescriptionForm({...prescriptionForm, icdCodes: e.target.value})}
                          placeholder="e.g. J00 - Acute nasopharyngitis"
                          className="bg-slate-50/50 border-slate-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Medications</label>
                          <Button size="sm" variant="outline" onClick={addMedication} className="h-7 text-[10px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold">
                            + ADD MEDICATION
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {prescriptionForm.medications.length === 0 && (
                            <div className="text-center py-6 border-2 border-dashed rounded-xl text-xs text-slate-400 bg-slate-50/50">
                              No medications added
                            </div>
                          )}
                          {prescriptionForm.medications.map((med, idx) => (
                            <div key={idx} className="flex gap-2 items-end border border-slate-100 p-3 rounded-xl bg-white shadow-sm">
                              <div className="flex-1 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Medicine</label>
                                <Input 
                                  value={med.name} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMedication(idx, "name", e.target.value)}
                                  placeholder="e.g. Paracetamol 500mg"
                                  className="h-8 text-xs bg-slate-50/30"
                                />
                              </div>
                              <div className="w-20 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Dose</label>
                                <Input 
                                  value={med.dose} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMedication(idx, "dose", e.target.value)}
                                  placeholder="1-0-1"
                                  className="h-8 text-xs bg-slate-50/30"
                                />
                              </div>
                              <div className="w-20 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Days</label>
                                <Input 
                                  value={med.freq} 
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMedication(idx, "freq", e.target.value)}
                                  placeholder="5 days"
                                  className="h-8 text-xs bg-slate-50/30"
                                />
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => removeMedication(idx)} className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Clinical Advice</label>
                        <Textarea 
                          value={prescriptionForm.instructions} 
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrescriptionForm({...prescriptionForm, instructions: e.target.value})}
                          placeholder="Advice on lifestyle, follow-up, or red flags..."
                          className="min-h-[100px] text-xs bg-slate-50/50 border-slate-200"
                        />
                      </div>
                      <Button 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 shadow-lg shadow-emerald-600/20" 
                        onClick={handleSavePrescription} 
                        disabled={savingPrescription}
                      >
                        {savingPrescription ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> SAVING...</>
                        ) : (
                          <><FileText className="w-4 h-4 mr-2" /> FINALIZE PRESCRIPTION</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {prescription && (
                  <Card className="border-emerald-100 bg-emerald-50/30 overflow-hidden shadow-sm">
                    <div className="bg-emerald-600 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Signed Prescription</span>
                      </div>
                      <span className="text-[9px] text-white/70 font-mono">VERIFIED BY DR. {doctor?.name?.toUpperCase()}</span>
                    </div>
                    <CardContent className="p-5 space-y-5">
                      {prescription.icdCodes && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Primary Diagnosis</p>
                          <p className="text-sm font-bold text-slate-900">{prescription.icdCodes}</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Prescribed Medications</p>
                        <div className="bg-white rounded-xl border border-emerald-100 divide-y divide-emerald-50 overflow-hidden shadow-sm">
                          {medications.map((m, idx) => (
                            <div key={idx} className="p-3.5 flex items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                  <Pill className="w-4 h-4 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{m.name}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{m.freq}</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200 font-bold text-[10px]">
                                {m.dose}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {prescription.instructions && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Doctor's Advice</p>
                          <div className="bg-white border border-emerald-100 rounded-xl p-3.5 shadow-sm">
                            <p className="text-xs text-slate-600 leading-relaxed italic">
                              "{prescription.instructions}"
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-2 flex justify-between items-center">
                        <div className="text-[10px] text-slate-400 italic">
                          Generated on {new Date(prescription.createdAt).toLocaleDateString("en-IN")}
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-[11px] gap-2 border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 font-bold">
                          <FileText className="w-3.5 h-3.5" /> DOWNLOAD PDF
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!prescription && data.viewerRole === "patient" && (
                  <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-slate-50/50">
                    <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <ClipboardList className="w-7 h-7 text-slate-200" />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Prescription Pending</h3>
                    <p className="text-xs text-slate-500 mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                      Your doctor is currently reviewing your case. The finalized prescription will appear here shortly.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
