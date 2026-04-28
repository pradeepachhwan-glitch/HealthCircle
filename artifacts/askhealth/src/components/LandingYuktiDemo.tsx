import { useState } from "react";
import { Link } from "wouter";
import { Loader2, Sparkles, AlertTriangle, ArrowRight, Send } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const SAMPLE_QUESTIONS = [
  "I have a sore throat for 3 days. Should I worry?",
  "What helps with acidity at night?",
  "Best diet for managing PCOS?",
];

interface PublicAskResponse {
  reply: string;
  summary: string;
  recommendations: string[];
  risk_level: "low" | "medium" | "high" | "emergency";
  emergency: boolean;
}

export function LandingYuktiDemo() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<PublicAskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(false);

  async function handleAsk(e?: React.FormEvent) {
    e?.preventDefault();
    if (used || loading) return;
    const q = question.trim();
    if (q.length < 3) {
      setError("Please type a health question (at least 3 characters).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/public/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError((body as { message?: string; error?: string }).message ?? (body as { error?: string }).error ?? "Yukti is unavailable. Please try again.");
        return;
      }
      setAnswer(body as PublicAskResponse);
      setUsed(true);
    } catch {
      setError("Network issue — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 mb-4" data-testid="landing-yukti-demo">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-indigo-50 to-purple-50 px-5 py-3 flex items-center gap-2 border-b border-slate-100">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-slate-800">Try Yukti — Ask 1 free question</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400 font-medium">No signup needed</span>
        </div>

        {!answer ? (
          <form onSubmit={handleAsk} className="p-5 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => { setQuestion(e.target.value); if (error) setError(null); }}
                placeholder="e.g. I get headaches every evening — what could it be?"
                maxLength={500}
                disabled={loading}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-slate-800 placeholder:text-slate-400 transition-all"
                data-testid="input-yukti-demo-question"
              />
              <button
                type="submit"
                disabled={loading || question.trim().length < 3}
                className="px-5 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                data-testid="button-yukti-demo-ask"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /><span className="hidden sm:inline">Ask</span></>}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[11px] text-slate-400 self-center mr-1">Try:</span>
              {SAMPLE_QUESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQuestion(s)}
                  disabled={loading}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-primary/40 hover:text-primary transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1">You asked</p>
              <p className="text-sm text-slate-700">{question}</p>
            </div>

            {answer.emergency && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800 font-medium">This sounds like it could be an emergency. Please see the response below and act immediately.</p>
              </div>
            )}

            <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 border border-indigo-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] uppercase tracking-wide text-primary font-semibold">Yukti says</p>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap" data-testid="text-yukti-demo-reply">{answer.reply}</p>
              {answer.recommendations.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {answer.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-700 flex gap-2">
                      <span className="text-primary">•</span><span>{rec}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-gradient-to-br from-primary to-indigo-600 rounded-xl p-5 text-white shadow-md">
              <p className="text-base font-semibold mb-1">Want to ask more?</p>
              <p className="text-sm text-white/90 mb-4">Create a free account to chat unlimited with Yukti, save your history, and join health communities.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/sign-in" className="flex-1 text-center px-5 py-2.5 bg-white text-primary rounded-xl font-semibold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2" data-testid="button-yukti-demo-signup">
                  Create free account <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/sign-in" className="flex-1 text-center px-5 py-2.5 bg-white/10 backdrop-blur text-white border border-white/30 rounded-xl font-semibold text-sm hover:bg-white/20 transition-all" data-testid="button-yukti-demo-signin">
                  Sign in
                </Link>
              </div>
            </div>

            <p className="text-[11px] text-center text-slate-400">
              Yukti provides health information for educational purposes only. Always consult a qualified doctor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
