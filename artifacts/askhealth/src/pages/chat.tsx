import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import {
  Send, Plus, Trash2, Bot, User, AlertTriangle, CheckCircle,
  Activity, Mic, Paperclip, Menu, X, ChevronRight, Stethoscope, ArrowLeft, UserCheck
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const communityContext = getCommunityFromUrl();

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

  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/chat/sessions`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
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
      const r = await fetch(`${API_BASE}/chat/sessions`, { method: "POST", credentials: "include" });
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
    mutationFn: async ({ sessionId, message }: { sessionId: number; message: string }) => {
      const r = await fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!r.ok) {
        if (r.status === 401) { const e = new Error("Unauthorized"); (e as any).status = 401; throw e; }
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
    if (!msg) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      const session = await createSession.mutateAsync();
      sessionId = session.id;
    }
    setInput("");
    sendMessage.mutate({ sessionId, message: msg });
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
          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
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
                  onFollowUp={(q) => handleSend(q)}
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
            <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2">
              <button className="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Voice (coming soon)">
                <Mic className="w-5 h-5" />
              </button>
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={communityContext
                  ? `Ask Yukti about ${communityContext.name}…`
                  : "Describe your symptoms or ask a health question…"}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm resize-none"
                disabled={sendMessage.isPending}
              />
              <button className="text-slate-400 hover:text-slate-600 transition-colors p-1" title="Attach file (coming soon)">
                <Paperclip className="w-5 h-5" />
              </button>
              <Button
                size="icon"
                className="w-8 h-8 bg-primary hover:bg-primary/90 rounded-xl flex-shrink-0"
                onClick={() => handleSend()}
                disabled={!input.trim() || sendMessage.isPending}
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
    </div>
  );
}
