import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Loader2, Sparkles, AlertTriangle, ArrowRight, Send, Thermometer, Moon, Flower2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WhyThisAnswer } from "@/components/WhyThisAnswer";
import { VoiceMic, SpeakButton, type VoiceMicHandle } from "@/components/VoiceMic";
import { speak, cancelSpeech } from "@/lib/voice";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

/**
 * Each example chip carries its own colored gradient + a topical icon so the
 * three suggestions read as distinct invitations rather than a wall of grey
 * pills. Static class strings (no interpolation) so Tailwind's JIT picks them
 * up. Tones are chosen to match the topic: amber=throat/inflammation,
 * indigo=night/sleep, rose=feminine wellness.
 */
const SAMPLE_QUESTIONS: { text: string; icon: LucideIcon; tone: "amber" | "indigo" | "rose" }[] = [
  { text: "Sore throat for 3 days. Should I worry?", icon: Thermometer, tone: "amber" },
  { text: "What helps with acidity at night?",       icon: Moon,        tone: "indigo" },
  { text: "Best diet for managing PCOS?",            icon: Flower2,     tone: "rose" },
];

const TONE_CLASSES: Record<"amber" | "indigo" | "rose", string> = {
  amber:  "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 text-amber-800 hover:from-amber-100 hover:to-orange-100 hover:border-amber-300 hover:text-amber-900",
  indigo: "bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200 text-indigo-800 hover:from-indigo-100 hover:to-violet-100 hover:border-indigo-300 hover:text-indigo-900",
  rose:   "bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200 text-rose-800 hover:from-rose-100 hover:to-pink-100 hover:border-rose-300 hover:text-rose-900",
};

interface PublicAskResponse {
  reply: string;
  summary: string;
  recommendations: string[];
  risk_level: "low" | "medium" | "high" | "emergency";
  emergency: boolean;
  /** "Why this answer?" trust-footer fields — optional so older API
   *  responses (or the public demo before this change shipped) still parse. */
  topic_tags?: string[];
  sources?: string[];
}

/**
 * Custom event the FloatingYuktiPill (or any other widget) can dispatch to
 * remotely kick off voice dictation in this demo. We keep the gesture chain
 * intact: the user's click on the floating pill IS the user gesture, and the
 * mic.start() call happens synchronously in the event handler.
 */
const VOICE_TRIGGER_EVENT = "yukti-voice-start";

export function LandingYuktiDemo() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<PublicAskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(false);
  /** True if the current question was dictated — drives auto-speak of the reply. */
  const [voiceMode, setVoiceMode] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const micRef = useRef<VoiceMicHandle | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Some embedded contexts (Replit canvas iframe, certain mobile browsers)
  // do not pass keystrokes through unless the field is *explicitly* focused.
  // Focus once on mount so users can start typing immediately, and again
  // whenever they click anywhere inside the demo card.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 200);
    return () => window.clearTimeout(t);
  }, []);
  function focusInput() { inputRef.current?.focus(); }

  // Listen for a global "start voice" trigger from the floating pill.
  // We scroll the demo into view and start the mic immediately. The user
  // gesture from the pill click propagates synchronously, so the browser
  // permits the SpeechRecognition.start() call.
  useEffect(() => {
    const handler = () => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setVoiceMode(true);
      // Defer slightly so the scroll begins before the recogniser opens.
      window.setTimeout(() => micRef.current?.start(), 60);
    };
    window.addEventListener(VOICE_TRIGGER_EVENT, handler);
    return () => window.removeEventListener(VOICE_TRIGGER_EVENT, handler);
  }, []);

  // Cancel any in-flight speech if the component unmounts.
  useEffect(() => {
    return () => cancelSpeech();
  }, []);

  async function handleAsk(e?: React.FormEvent, overrideText?: string) {
    e?.preventDefault();
    if (used || loading) return;
    const q = (overrideText ?? question).trim();
    if (q.length < 3) {
      setError("Please type or speak a health question (at least 3 characters).");
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
      const reply = body as PublicAskResponse;
      setAnswer(reply);
      setUsed(true);
      // If the user dictated, automatically read the reply aloud — closes
      // the voice loop without requiring an extra tap.
      if (voiceMode && reply.reply) {
        void speak(reply.reply, { lang: "en-IN" });
      }
    } catch {
      setError("Network issue — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 mb-4" data-testid="landing-yukti-demo" ref={containerRef}>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-indigo-50 to-purple-50 px-5 py-3 flex items-center gap-2 border-b border-slate-100">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-slate-900">Try Yukti — Ask 1 free question</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600 font-bold">No signup needed</span>
        </div>

        {!answer ? (
          <form onSubmit={(e) => handleAsk(e)} className="p-5 space-y-3" onClick={focusInput}>
            <div className="flex gap-2 items-stretch">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => { setQuestion(e.target.value); if (error) setError(null); setVoiceMode(false); }}
                placeholder="Type or tap the mic to ask…"
                maxLength={500}
                readOnly={loading}
                autoFocus
                inputMode="text"
                enterKeyHint="send"
                autoComplete="off"
                spellCheck
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm text-slate-900 placeholder:text-slate-500 transition-all bg-white"
                data-testid="input-yukti-demo-question"
              />
              {/* Mic button — handles both voice input AND, on final transcript,
                  auto-submits. Hides itself if the browser doesn't support SR. */}
              <VoiceMic
                ref={micRef}
                size="md"
                disabled={loading}
                language="en-IN"
                onTranscript={(text) => {
                  setQuestion(text);
                  setVoiceMode(true);
                  if (error) setError(null);
                }}
                onFinal={(text) => {
                  // Slight defer so the input value visibly updates before submit.
                  window.setTimeout(() => handleAsk(undefined, text), 120);
                }}
                testId="yukti-demo-mic"
                label="Speak your question to Yukti"
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
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <span className="text-[12px] text-slate-600 self-center mr-1 font-medium">Or pick an example:</span>
              {SAMPLE_QUESTIONS.map(({ text, icon: Icon, tone }) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => { setQuestion(text); focusInput(); }}
                  disabled={loading}
                  className={`group inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none ${TONE_CLASSES[tone]}`}
                  data-testid={`button-yukti-demo-example-${tone}`}
                >
                  <Icon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110" strokeWidth={2.25} />
                  <span>{text}</span>
                </button>
              ))}
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-700 font-bold mb-1">You asked</p>
              <p className="text-sm text-slate-800">{question}</p>
            </div>

            {answer.emergency && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800 font-semibold">This sounds like it could be an emergency. Please see the response below and act immediately.</p>
              </div>
            )}

            <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 border border-indigo-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] uppercase tracking-wide text-primary font-bold">Yukti says</p>
                {/* Listen button — replays the answer aloud on demand */}
                <SpeakButton
                  text={answer.reply}
                  language="en-IN"
                  className="ml-auto"
                  testId="yukti-demo-listen"
                />
              </div>
              <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap" data-testid="text-yukti-demo-reply">{answer.reply}</p>
              {answer.recommendations.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {answer.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-800 flex gap-2">
                      <span className="text-primary">•</span><span>{rec}</span>
                    </li>
                  ))}
                </ul>
              )}
              <WhyThisAnswer
                topicTags={answer.topic_tags}
                sources={answer.sources}
                variant="light"
                testId="landing-yukti-why"
              />
            </div>

            <div className="bg-gradient-to-br from-primary to-indigo-600 rounded-xl p-5 text-white shadow-md">
              <p className="text-base font-bold mb-1">Want to ask more?</p>
              <p className="text-sm text-white/95 mb-4">Create a free account to chat unlimited with Yukti, save your history, and join health communities.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/sign-in" className="flex-1 text-center px-5 py-2.5 bg-white text-primary rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2" data-testid="button-yukti-demo-signup">
                  Create free account <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/sign-in" className="flex-1 text-center px-5 py-2.5 bg-white/10 backdrop-blur text-white border border-white/40 rounded-xl font-semibold text-sm hover:bg-white/20 transition-all" data-testid="button-yukti-demo-signin">
                  Sign in
                </Link>
              </div>
            </div>

            <p className="text-[11px] text-center text-slate-600">
              Yukti provides health information for educational purposes only. Always consult a qualified doctor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
