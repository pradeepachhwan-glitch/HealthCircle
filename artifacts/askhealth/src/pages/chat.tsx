import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useClerk, useAuth } from "@workspace/replit-auth-web";
import { QuotaExhaustedModal, type QuotaInfo } from "@/components/QuotaExhaustedModal";
import {
  Send, Plus, Trash2, Bot, User, AlertTriangle, CheckCircle,
  Activity, Mic, MicOff, Paperclip, Menu, X, ChevronRight, Stethoscope, ArrowLeft, UserCheck,
  FileText, Loader2
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

interface ChatSession {
  id: number;
  title: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: number;
  sessionId: number;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  structuredResponse?: StructuredResponse;
  language: string;
  createdAt: string;
}

interface StructuredResponse {
  intent: string;
  summary: string;
  risk_level: "low" | "medium" | "high" | "emergency";
  recommendations: string[];
  suggested_questions: string[];
  disclaimer: string;
  reply: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
  emergency: "bg-red-100 text-red-800 border-red-300",
};

const RISK_ICONS: Record<string, typeof Activity> = {
  low: CheckCircle,
  medium: Activity,
  high: AlertTriangle,
  emergency: AlertTriangle,
};

const INTENT_LABELS: Record<string, string> = {
  symptom: "Symptom Check",
  treatment: "Treatment Info",
  doctor: "Find Doctor",
  lab: "Lab Tests",
  general: "Health Info",
  emergency: "Emergency",
};

const DEFAULT_PROMPTS = [
  "I have a fever and sore throat. What should I do?",
  "Find me a cardiologist in Mumbai",
  "What are the symptoms of diabetes?",
  "How do I prepare for a blood test?",
  "My back pain has been going on for 3 days",
];

function StructuredCard({ data, onFollowUp }: { data: StructuredResponse; onFollowUp?: (q: string) => void }) {
  const RiskIcon = RISK_ICONS[data.risk_level] ?? Activity;
  return (
    <div className="mt-3 space-y-3">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium w-fit ${RISK_COLORS[data.risk_level]}`}>
        <RiskIcon className="w-3.5 h-3.5" />
        Risk Level: {data.risk_level.toUpperCase()}
        {data.intent && <span className="ml-2 opacity-70">• {INTENT_LABELS[data.intent] ?? data.intent}</span>}
      </div>

      {data.summary && (
        <div className="bg-white/60 rounded-xl p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-800 mb-1">Summary</p>
          <p className="leading-relaxed">{data.summary}</p>
        </div>
      )}

      {data.recommendations && data.recommendations.length > 0 && (
        <div className="bg-white/60 rounded-xl p-3">
          <p className="font-medium text-slate-800 text-sm mb-2">Recommendations</p>
          <ul className="space-y-1.5">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-primary flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.disclaimer && (
        <p className="text-[11px] text-slate-400 italic">{data.disclaimer}</p>
      )}

      {data.suggested_questions && data.suggested_questions.length > 0 && onFollowUp && (
        <div className="flex flex-wrap gap-2">
          {data.suggested_questions.map((q, i) => (
            <button
              key={i}
              onClick={() => onFollowUp(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message, onFollowUp, onRequestDoctor, consultationRequested, showDoctorButton
}: {
  message: ChatMessage;
  onFollowUp?: (q: string) => void;
  onRequestDoctor?: () => void;
  consultationRequested?: boolean;
  showDoctorButton?: boolean;
}) {
  const isUser = message.role === "user";
  const isHighRisk = message.structuredResponse?.risk_level === "high" || message.structuredResponse?.risk_level === "emergency";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-slate-200" : "bg-primary text-white"}`}>
        {isUser ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? "bg-primary text-white rounded-tr-sm" : "bg-slate-100 text-slate-800 rounded-tl-sm"}`}>
          {message.content}
        </div>
        {!isUser && message.structuredResponse && (
          <div className="mt-1 w-full">
            <StructuredCard data={message.structuredResponse} onFollowUp={onFollowUp} />
          </div>
        )}
        {!isUser && showDoctorButton && isHighRisk && onRequestDoctor && (
          <div className="mt-2 w-full">
            {consultationRequested ? (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                Doctor consultation request sent — a medical professional will review your case shortly.
              </div>
            ) : (
              <button
                onClick={onRequestDoctor}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors font-medium"
              >
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                Get a Doctor's Opinion — request professional review
              </button>
            )}
          </div>
        )}
        <span className="text-[11px] text-slate-400 mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function getCommunityFromUrl(): { slug: string; name: string } | null {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("community");
  const name = params.get("communityName");
  if (slug && name) return { slug, name: decodeURIComponent(name) };
  return null;
}

function getInitialPromptFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("prompt");
  if (!raw) return null;
  // Defensive: cap the deep-link prompt length so a runaway URL can't dump
  // multi-KB into the input. 800 chars is plenty for "summarise this video"
  // type CTAs from the content cards.
  const trimmed = raw.trim().slice(0, 800);
  return trimmed.length > 0 ? trimmed : null;
}

export default function ChatPage() {
  const { toast } = useToast();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [consultationRequested, setConsultationRequested] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [quotaModalOpen, setQuotaModalOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const communityContext = getCommunityFromUrl();

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
    };
  }, []);

  // Deep-link from a content card (or any external link) can pre-fill the
  // input box via ?prompt=... — we DON'T auto-send so the user can edit
  // before submitting (consistent with the follow-up-chip behaviour).
  // Strip the prompt from the URL after applying it so a refresh doesn't
  // keep re-prefilling over user edits.
  useEffect(() => {
    const initialPrompt = getInitialPromptFromUrl();
    if (!initialPrompt) return;
    setInput(initialPrompt);
    requestAnimationFrame(() => {
      const el = messageInputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("prompt");
      window.history.replaceState({}, "", url.toString());
    } catch { /* noop */ }
    // Empty deps: run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleVoice() {
    const W = window as any;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice not supported", description: "Your browser doesn't support voice input. Please use Chrome or Edge.", variant: "destructive" });
      return;
    }
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    // Match the user's preferred Indic language for speech recognition.
    // Falls back to en-IN. Supports Hindi, Bengali, Tamil, Telugu, Marathi,
    // Gujarati, Punjabi, Kannada, Malayalam, Urdu.
    const preferredLang = (navigator.language ?? "en-IN").toLowerCase();
    const langMap: Record<string, string> = {
      hi: "hi-IN", bn: "bn-IN", ta: "ta-IN", te: "te-IN", mr: "mr-IN",
      gu: "gu-IN", pa: "pa-IN", kn: "kn-IN", ml: "ml-IN", ur: "ur-IN",
    };
    const code = preferredLang.split(/[-_]/)[0];
    rec.lang = langMap[code] ?? "en-IN";
    rec.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(prev => (prev ? prev + " " : "") + transcript);
    };
    rec.onerror = (e: any) => {
      setIsListening(false);
      const msg = e?.error === "not-allowed" ? "Microphone access denied. Please allow mic permission." : "Voice input failed. Please try again.";
      toast({ title: "Voice error", description: msg, variant: "destructive" });
    };
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    try { rec.start(); setIsListening(true); }
    catch { setIsListening(false); toast({ title: "Voice error", description: "Could not start microphone.", variant: "destructive" }); }
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 4 MB.", variant: "destructive" });
      return;
    }
    if (!/^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/i.test(file.type)) {
      toast({ title: "Unsupported file", description: "Only images (PNG, JPG, WebP, GIF) and PDF are supported.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const r = await fetch(`${API_BASE}/uploads/inline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, name: file.name }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Upload failed");
      }
      const result = await r.json();
      setPendingAttachment({ url: result.url, type: file.type, name: file.name });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message ?? "Could not upload file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSessionExpired() {
    toast({
      title: "Session expired",
      description: "Please sign in again to continue.",
      variant: "destructive",
    });
    await signOut();
    setLocation("/sign-in");
  }

  const { data: communityPrompts } = useQuery<{ suggestedQuestions: string[] }>({
    queryKey: ["community-prompts", communityContext?.slug],
    queryFn: () => communityContext
      ? fetch(`${API_BASE}/ai/community-prompts/${communityContext.slug}`).then(r => r.json())
      : Promise.resolve({ suggestedQuestions: DEFAULT_PROMPTS }),
    enabled: true,
  });

  const suggestedPrompts = communityPrompts?.suggestedQuestions ?? DEFAULT_PROMPTS;

  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const authReady = clerkLoaded && isSignedIn;

  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/chat/sessions`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: authReady,
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return [];
      const r = await fetch(`${API_BASE}/chat/sessions/${activeSessionId}/messages`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!activeSessionId,
  });

  const requestConsultation = useMutation({
    mutationFn: async (sessionId: number) => {
      const lastMsg = messages.filter(m => m.role === "assistant").slice(-1)[0];
      const riskLevel = lastMsg?.structuredResponse?.risk_level ?? "high";
      const r = await fetch(`${API_BASE}/chat/sessions/${sessionId}/request-consultation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ riskLevel, reason: `AI flagged ${riskLevel} risk during chat session` }),
      });
      if (!r.ok) throw new Error("Failed to request consultation");
      return r.json();
    },
    onSuccess: (data) => {
      setConsultationRequested(true);
      toast({ title: data.alreadyExists ? "Already requested" : "Consultation requested!", description: "A medical professional will review your case." });
    },
    onError: () => toast({ title: "Error", description: "Could not request consultation. Please try again.", variant: "destructive" }),
  });

  const createSession = useMutation({
    mutationFn: async () => {
      // If the chat was opened from a community card, pin the session to that
      // community so every Yukti reply uses the matching specialist persona.
      const ctx = getCommunityFromUrl();
      const r = await fetch(`${API_BASE}/chat/sessions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx ? { communitySlug: ctx.slug, communityName: ctx.name } : {}),
      });
      if (r.status === 401) { const e = new Error("Unauthorized"); (e as any).status = 401; throw e; }
      if (!r.ok) throw new Error("Failed to create chat session");
      return r.json() as Promise<ChatSession>;
    },
    onSuccess: (session) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      setActiveSessionId(session.id);
    },
    onError: (err: Error) => {
      if ((err as any).status === 401) { handleSessionExpired(); return; }
      toast({ title: "Error", description: "Couldn't start a new chat. Please try again.", variant: "destructive" });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API_BASE}/chat/sessions/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Failed to delete session");
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      if (activeSessionId === id) setActiveSessionId(null);
    },
  });

  const sendMessage = useMutation({
    mutationFn: async ({ sessionId, message, attachment }: { sessionId: number; message: string; attachment?: { url: string; type: string; name: string } | null }) => {
      const r = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, attachment: attachment ?? null }),
      });
      if (!r.ok) {
        if (r.status === 401) { const e = new Error("Unauthorized"); (e as any).status = 401; throw e; }
        if (r.status === 429) {
          const body = await r.json().catch(() => ({}));
          const e = new Error("quota_exceeded");
          (e as any).status = 429;
          (e as any).quota = (body as any).quota ?? null;
          throw e;
        }
        const body = await r.json().catch(() => ({}));
        throw new Error((body as any).error ?? "Failed to send message");
      }
      return r.json();
    },
    onMutate: () => setIsTyping(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeSessionId] });
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      setIsTyping(false);
    },
    onError: (err: Error) => {
      setIsTyping(false);
      if ((err as any).status === 401) { handleSessionExpired(); return; }
      if ((err as any).status === 429) {
        setQuotaInfo((err as any).quota ?? null);
        setQuotaModalOpen(true);
        return;
      }
      toast({
        title: "Yukti is unavailable",
        description: err.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    const attachment = pendingAttachment;
    if (!msg && !attachment) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession.mutateAsync();
      sessionId = session.id;
    }
    setInput("");
    setPendingAttachment(null);
    sendMessage.mutate({ sessionId, message: msg, attachment });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-72" : "w-0"} flex-shrink-0 transition-all duration-300 overflow-hidden bg-white border-r border-slate-200 flex flex-col`}>
        <div className="p-4 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2 mb-4 group">
            <span className="font-bold text-slate-900">HealthCircle</span>
          </Link>
          <Button onClick={() => createSession.mutate()} className="w-full gap-2 bg-primary hover:bg-primary/90" size="sm" disabled={createSession.isPending}>
            <Plus className="w-4 h-4" /> New Chat
          </Button>
        </div>

        <ScrollArea className="flex-1 p-2">
          {sessions.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-8">No conversations yet</p>
          )}
          {sessions.map(session => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-colors ${activeSessionId === session.id ? "bg-primary/10 text-primary" : "hover:bg-slate-100 text-slate-700"}`}
              onClick={() => { setActiveSessionId(session.id); setConsultationRequested(false); }}
            >
              <Stethoscope className="w-4 h-4 flex-shrink-0 opacity-60" />
              <span className="flex-1 text-sm truncate">{session.title}</span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500"
                onClick={e => { e.stopPropagation(); deleteSession.mutate(session.id); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </ScrollArea>

        <div className="p-3 border-t border-slate-100">
          {communityContext ? (
            <Link href={`/communities/${communityContext.slug}`}>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-slate-600">
                <ArrowLeft className="w-4 h-4" /> Back to {communityContext.name}
              </Button>
            </Link>
          ) : (
            <Link href="/communities">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-slate-600">
                <ArrowLeft className="w-4 h-4" /> Back to Communities
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0">
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Bot className="w-5 h-5 text-primary" />
            <div>
              <p className="font-semibold text-sm text-slate-900">
                {activeSession ? activeSession.title : "Yukti — Health Assistant"}
              </p>
              <p className="text-xs text-slate-500">
                {communityContext ? `${communityContext.name} specialist` : "AI-powered healthcare guidance"}
              </p>
            </div>
          </div>
          {communityContext && (
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 hidden sm:flex">
              {communityContext.name}
            </Badge>
          )}
          <Link href="/providers">
            <Button
              size="sm"
              variant="outline"
              className="hidden sm:inline-flex h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
              data-testid="chat-find-doctor-button"
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Find a Doctor
            </Button>
          </Link>
          <Link href="/providers">
            <Button
              size="icon"
              variant="outline"
              className="sm:hidden w-8 h-8 border-primary/30 text-primary hover:bg-primary/5"
              aria-label="Find a Doctor"
              data-testid="chat-find-doctor-button-mobile"
            >
              <Stethoscope className="w-3.5 h-3.5" />
            </Button>
          </Link>
          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs hidden md:inline-flex">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 inline-block" />
            Online
          </Badge>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-6">
          {!activeSessionId && (
            <div className="max-w-xl mx-auto text-center space-y-6 py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Hi, I'm Yukti
                  {communityContext && <span className="text-primary"> — {communityContext.name} Expert</span>}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {communityContext
                    ? `I'm your specialised AI assistant for the ${communityContext.name} community. Ask me anything related to ${communityContext.name} topics.`
                    : "Your AI health assistant. Ask me about symptoms, treatments, finding doctors, or any health concern — in English or Hindi."}
                </p>
              </div>
              <div className="grid gap-2">
                {suggestedPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-primary/30 text-sm text-slate-700 transition-all"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSessionId && messages.length === 0 && !isTyping && (
            <div className="text-center text-slate-400 text-sm py-16">
              <Bot className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>Ask Yukti anything about your health</p>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-5">
            {(() => {
              const lastAiMsgIdx = messages.map((m, i) => ({ m, i })).filter(({ m }) => m.role === "assistant").slice(-1)[0]?.i ?? -1;
              return messages.map((msg, idx) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onFollowUp={(q) => {
                    setInput(q);
                    requestAnimationFrame(() => {
                      const el = messageInputRef.current;
                      if (!el) return;
                      el.focus();
                      const len = el.value.length;
                      el.setSelectionRange(len, len);
                    });
                  }}
                  showDoctorButton={idx === lastAiMsgIdx}
                  consultationRequested={consultationRequested}
                  onRequestDoctor={activeSessionId ? () => requestConsultation.mutate(activeSessionId) : undefined}
                />
              ));
            })()}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="bg-white border-t border-slate-200 p-4">
          <div className="max-w-3xl mx-auto">
            {pendingAttachment && (
              <div className="flex items-center gap-3 mb-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                {pendingAttachment.type.startsWith("image/") ? (
                  <img src={pendingAttachment.url} alt={pendingAttachment.name} className="w-12 h-12 object-cover rounded-md border border-indigo-200" />
                ) : (
                  <div className="w-12 h-12 bg-white rounded-md border border-indigo-200 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{pendingAttachment.name}</p>
                  <p className="text-xs text-slate-500">Will be analysed by Yukti</p>
                </div>
                <button
                  onClick={() => setPendingAttachment(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={handleFilePick}
            />
            <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2">
              <button
                onClick={toggleVoice}
                className={`p-1 transition-colors ${isListening ? "text-red-500 hover:text-red-600 animate-pulse" : "text-slate-400 hover:text-slate-600"}`}
                title={isListening ? "Stop recording" : "Voice input"}
                type="button"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <Input
                ref={messageInputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={communityContext
                  ? `Ask Yukti about ${communityContext.name}…`
                  : "Describe your symptoms or ask a health question…"}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm resize-none"
                disabled={sendMessage.isPending}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !!pendingAttachment}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 disabled:opacity-50"
                title={pendingAttachment ? "Remove current attachment first" : "Attach image or PDF (max 4 MB)"}
                type="button"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <Button
                size="icon"
                className="w-8 h-8 bg-primary hover:bg-primary/90 rounded-xl flex-shrink-0"
                onClick={() => handleSend()}
                disabled={(!input.trim() && !pendingAttachment) || sendMessage.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              Yukti provides health information for educational purposes only. Always consult a qualified doctor.
            </p>
          </div>
        </div>
      </div>
      <QuotaExhaustedModal
        open={quotaModalOpen}
        quota={quotaInfo}
        onClose={() => setQuotaModalOpen(false)}
        onSubscribed={() => { qc.invalidateQueries({ queryKey: ["users-me-quota"] }); }}
      />
    </div>
  );
}
