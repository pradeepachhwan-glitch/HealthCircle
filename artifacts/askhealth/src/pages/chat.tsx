import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Send, Plus, Trash2, Bot, User, AlertTriangle, CheckCircle,
  Activity, Mic, Paperclip, Menu, X, ChevronRight, Stethoscope, ArrowLeft
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

function StructuredCard({ data }: { data: StructuredResponse }) {
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
          {data.summary}
        </div>
      )}

      {data.recommendations?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recommended Actions</p>
          <ul className="space-y-1">
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
        <p className="text-xs text-slate-400 italic border-t border-slate-100 pt-2">
          {data.disclaimer}
        </p>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-slate-900 text-white" : "bg-primary text-white"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser
          ? "bg-slate-900 text-white rounded-tr-sm"
          : "bg-slate-100 text-slate-800 rounded-tl-sm"}`}>
          {message.content}
        </div>
        {!isUser && message.structuredResponse && (
          <StructuredCard data={message.structuredResponse} />
        )}
        <span className="text-[11px] text-slate-400 px-1">
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

const SUGGESTED_PROMPTS = [
  "I have a fever and sore throat. What should I do?",
  "Find me a cardiologist in Mumbai",
  "What are the symptoms of diabetes?",
  "How do I prepare for a blood test?",
  "My back pain has been going on for 3 days",
];

export default function ChatPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: sessions = [] } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions"],
    queryFn: () => fetch(`${API_BASE}/chat/sessions`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", activeSessionId],
    queryFn: () => activeSessionId
      ? fetch(`${API_BASE}/chat/sessions/${activeSessionId}/messages`, { credentials: "include" }).then(r => r.json())
      : Promise.resolve([]),
    enabled: !!activeSessionId,
  });

  const createSession = useMutation({
    mutationFn: () =>
      fetch(`${API_BASE}/chat/sessions`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (session: ChatSession) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      setActiveSessionId(session.id);
    },
  });

  const deleteSession = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API_BASE}/chat/sessions/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      if (activeSessionId === id) setActiveSessionId(null);
    },
  });

  const sendMessage = useMutation({
    mutationFn: ({ sessionId, message }: { sessionId: number; message: string }) =>
      fetch(`${API_BASE}/chat/sessions/${sessionId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }).then(r => r.json()),
    onMutate: () => setIsTyping(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", activeSessionId] });
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
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
      <div className={`${sidebarOpen ? "w-72" : "w-0"} flex-shrink-0 transition-all duration-300 overflow-hidden bg-white border-r border-slate-200 flex flex-col`}>
        <div className="p-4 border-b border-slate-100">
          <Link href="/" className="flex items-center gap-2 mb-4 group">
            <span className="font-bold text-slate-900">HealthCircle</span>
          </Link>
          <Button onClick={() => createSession.mutate()} className="w-full gap-2 bg-primary hover:bg-primary/90" size="sm">
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
              onClick={() => setActiveSessionId(session.id)}
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
          <Link href="/communities">
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-slate-600">
              <ArrowLeft className="w-4 h-4" /> Back to Communities
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
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
              <p className="text-xs text-slate-500">AI-powered healthcare guidance</p>
            </div>
          </div>
          <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 inline-block" />
            Online
          </Badge>
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          {!activeSessionId && (
            <div className="max-w-xl mx-auto text-center space-y-6 py-12">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Hi, I'm Yukti</h2>
                <p className="text-slate-500 text-sm leading-relaxed">Your AI health assistant. Ask me about symptoms, treatments, finding doctors, or any health concern — in English or Hindi.</p>
              </div>
              <div className="grid gap-2">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    className="text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-primary/30 text-sm text-slate-700 transition-all"
                    onClick={() => { setInput(prompt); }}
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
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

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
                placeholder="Describe your symptoms or ask a health question…"
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
