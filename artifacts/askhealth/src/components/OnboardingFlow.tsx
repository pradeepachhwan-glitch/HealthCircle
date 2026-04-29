import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, ChevronRight, Loader2, Sparkles } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

const ONBOARDING_COMMUNITIES = [
  { id: null, slug: "mental-wellness",        emoji: "🧠", name: "Mind Space",    desc: "Talk, share, heal" },
  { id: null, slug: "diabetes-care",          emoji: "🩸", name: "Sugar Care",    desc: "Manage diabetes better" },
  { id: null, slug: "pregnancy-motherhood",   emoji: "🤰", name: "Mom Journey",   desc: "Pregnancy to parenting" },
  { id: null, slug: "weight-loss-fitness",    emoji: "🏃", name: "Fit Life",      desc: "Fitness your way" },
  { id: null, slug: "work-stress-burnout",    emoji: "💼", name: "Work Reset",    desc: "Beat burnout" },
  { id: null, slug: "heart-health",           emoji: "❤️", name: "Heart Circle",  desc: "Care for your heart" },
  { id: null, slug: "pcos-womens-health",     emoji: "🌸", name: "Cycle Sync",    desc: "Understand your cycle" },
  { id: null, slug: "respiratory-health",     emoji: "🫁", name: "Breathe Easy",  desc: "Better breathing" },
];

const QUESTION_SUGGESTIONS = [
  "I feel tired all the time",
  "I have irregular periods",
  "Feeling anxious and stressed lately",
  "Blood sugar spikes after meals",
];

const INTENT_OPTIONS = [
  { key: "concern", label: "I have a health concern", emoji: "🩺" },
  { key: "explore", label: "I want to explore", emoji: "🔍" },
  { key: "manage", label: "I'm managing a condition", emoji: "💊" },
];

// Simple keyword → slug mapping for auto-routing
const KEYWORD_MAP: { keywords: string[]; slug: string }[] = [
  { keywords: ["heart", "chest", "cardiac", "blood pressure", "bp", "pulse"], slug: "heart-health" },
  { keywords: ["anxiety", "stress", "mental", "depress", "mood", "sleep", "burnout"], slug: "mental-wellness" },
  { keywords: ["sugar", "diabetes", "glucose", "insulin", "hba1c"], slug: "diabetes-care" },
  { keywords: ["pregnant", "baby", "motherhood", "delivery", "trimester", "breastfeed"], slug: "pregnancy-motherhood" },
  { keywords: ["fit", "weight", "gym", "exercise", "obesity", "bmi"], slug: "weight-loss-fitness" },
  { keywords: ["work", "burnout", "fatigue", "overwork", "stress"], slug: "work-stress-burnout" },
  { keywords: ["period", "pcos", "menstrual", "cycle", "hormonal"], slug: "pcos-womens-health" },
  { keywords: ["breath", "asthma", "cough", "lung", "respiratory", "inhaler"], slug: "respiratory-health" },
];

function pickCommunitySlug(question: string, selectedSlugs: string[]): string {
  const lower = question.toLowerCase();
  for (const { keywords, slug } of KEYWORD_MAP) {
    if (selectedSlugs.includes(slug) && keywords.some(k => lower.includes(k))) return slug;
  }
  // Fallback: any keyword match
  for (const { keywords, slug } of KEYWORD_MAP) {
    if (keywords.some(k => lower.includes(k))) return slug;
  }
  // Last resort: first selected community
  return selectedSlugs[0] ?? "mental-wellness";
}

interface OnboardingFlowProps {
  userId: string;
  onComplete: () => void;
}



export default function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [question, setQuestion] = useState("");
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<{ communityId: number; postId: number; communityName: string; aiSummary?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleSlug(slug: string) {
    setSelectedSlugs(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 3 ? [...prev, slug] : prev
    );
  }

  async function handlePost() {
    if (!question.trim()) return;
    setPosting(true);
    setError(null);

    try {
      // 1. Get communities list to resolve slugs → IDs
      const commRes = await fetch(`${API_BASE}/communities`, { credentials: "include" });
      if (!commRes.ok) throw new Error(`Communities fetch failed (${commRes.status})`);
      const communities: { id: number; slug: string; name: string }[] = await commRes.json();

      const targetSlug = pickCommunitySlug(question, selectedSlugs.length > 0 ? selectedSlugs : communities.map(c => c.slug));
      const targetCommunity = communities.find(c => c.slug === targetSlug) ?? communities[0];
      if (!targetCommunity) throw new Error("No community found");

      // 2. Join the target community (required — must succeed)
      const targetJoinRes = await fetch(`${API_BASE}/communities/${targetCommunity.id}/join`, {
        method: "POST",
        credentials: "include",
      });
      if (!targetJoinRes.ok && targetJoinRes.status !== 409) {
        throw new Error(`Couldn't join ${targetCommunity.name} (${targetJoinRes.status})`);
      }

      // 3. Join other selected communities in parallel (best-effort, non-blocking)
      const otherIds = selectedSlugs
        .map(slug => communities.find(x => x.slug === slug))
        .filter((c): c is { id: number; slug: string; name: string } => !!c && c.id !== targetCommunity.id)
        .map(c => c.id);
      if (otherIds.length > 0) {
        const results = await Promise.allSettled(
          otherIds.map(id =>
            fetch(`${API_BASE}/communities/${id}/join`, { method: "POST", credentials: "include" })
              .then(r => { if (!r.ok && r.status !== 409) throw new Error(`status ${r.status}`); return r; })
          )
        );
        const failed = results.filter(r => r.status === "rejected").length;
        if (failed > 0) console.warn(`[onboarding] ${failed}/${otherIds.length} optional community joins failed`);
      }

      // 4. Post the question
      const postRes = await fetch(`${API_BASE}/communities/${targetCommunity.id}/posts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: question.trim().slice(0, 120),
          content: question.trim(),
        }),
      });

      if (!postRes.ok) throw new Error(`Post failed (${postRes.status})`);
      const post = await postRes.json();

      setPostResult({
        communityId: targetCommunity.id,
        postId: post.id,
        communityName: targetCommunity.name,
      });
      setStep(6);
    } catch (err) {
      console.error("[onboarding] post failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  function finish() {
    localStorage.setItem(`onboarding_done_${userId}`, "1");
    onComplete();
  }

  /**
   * Skip the entire 6-step onboarding and drop the user straight into Yukti.
   * Marks onboarding as done so we never re-prompt, then routes to /chat.
   * This honours the "free means free — just by email or contact number" promise.
   */
  function skipAndChat() {
    localStorage.setItem(`onboarding_done_${userId}`, "1");
    onComplete();
    navigate("/chat");
  }

  const progress = (step / 6) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-slate-100 flex-shrink-0">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 text-sm">HealthCircle</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={skipAndChat}
            className="min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            data-testid="onboarding-skip"
          >
            Skip — just chat with Yukti
          </button>
          <span className="text-xs text-slate-400 hidden sm:inline">{step} of 6</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8 max-w-lg mx-auto w-full">

        {/* Step 1: Intent */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Welcome</p>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">What brings you here today?</h2>
              <p className="text-slate-500 text-sm mt-2">This helps us personalise your experience.</p>
            </div>
            <div className="space-y-3">
              {INTENT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setIntent(opt.key)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                    intent === opt.key
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <span className={`font-medium text-sm ${intent === opt.key ? "text-primary" : "text-slate-700"}`}>
                    {opt.label}
                  </span>
                  {intent === opt.key && <CheckCircle className="w-4 h-4 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Community selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Step 2 of 6</p>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">Choose your communities</h2>
              <p className="text-slate-500 text-sm mt-2">Pick 1–3 that match your health interests. You can change later.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ONBOARDING_COMMUNITIES.map(c => {
                const selected = selectedSlugs.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    onClick={() => toggleSlug(c.slug)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    } ${!selected && selectedSlugs.length >= 3 ? "opacity-50 cursor-not-allowed" : ""}`}
                    disabled={!selected && selectedSlugs.length >= 3}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xl">{c.emoji}</span>
                      {selected && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />}
                    </div>
                    <p className={`font-semibold text-sm ${selected ? "text-primary" : "text-slate-800"}`}>{c.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{c.desc}</p>
                  </button>
                );
              })}
            </div>
            {selectedSlugs.length === 3 && (
              <p className="text-xs text-slate-400 text-center">Maximum 3 selected. Unselect one to change.</p>
            )}
          </div>
        )}

        {/* Step 3: Consent */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Before you continue</p>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">A quick note on privacy & AI</h2>
              <p className="text-slate-500 text-sm mt-2">Your safety and trust matter to us.</p>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <h3 className="font-semibold text-slate-800 text-sm mb-1">🔒 Your data stays private</h3>
                <p className="text-xs text-slate-500">Your health information is shared only within communities you join. We never sell your data.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <h3 className="font-semibold text-slate-800 text-sm mb-1">🤖 AI is not a doctor</h3>
                <p className="text-xs text-slate-500">Yukti AI provides educational summaries. It cannot diagnose conditions or prescribe treatment.</p>
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setConsent1(!consent1)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 mt-0.5 transition-colors ${consent1 ? "bg-primary border-primary" : "border-slate-300 group-hover:border-slate-400"}`}
                >
                  {consent1 && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm text-slate-700">
                  I agree to share health information within the communities I join
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setConsent2(!consent2)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 flex-shrink-0 mt-0.5 transition-colors ${consent2 ? "bg-primary border-primary" : "border-slate-300 group-hover:border-slate-400"}`}
                >
                  {consent2 && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm text-slate-700">
                  I understand AI guidance is not a medical diagnosis
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: First question */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Step 4 of 6</p>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">Ask your first question</h2>
              <p className="text-slate-500 text-sm mt-2">Describe what you're experiencing. We'll route it to the right community.</p>
            </div>
            <Textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Describe what you're experiencing…"
              className="min-h-[120px] text-sm rounded-2xl border-slate-200 focus-visible:ring-primary/30 resize-none"
              autoFocus
            />
            <div>
              <p className="text-xs text-slate-400 mb-2 font-medium">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {QUESTION_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setQuestion(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Posting */}
        {step === 5 && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
            {posting ? (
              <>
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="font-semibold text-slate-700">Finding the right community…</p>
                <p className="text-sm text-slate-400">Posting your question and generating AI insights</p>
              </>
            ) : error ? (
              <>
                <div className="text-4xl">⚠️</div>
                <p className="text-red-600 font-medium text-sm">{error}</p>
                <Button onClick={() => { setError(null); handlePost(); }} className="bg-primary hover:bg-primary/90">
                  Try Again
                </Button>
              </>
            ) : null}
          </div>
        )}

        {/* Step 6: Success */}
        {step === 6 && postResult && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">You're all set! 🎉</h2>
              <p className="text-slate-500 text-sm mt-2">
                Your question is live in <span className="font-semibold text-primary">{postResult.communityName}</span>.
                Yukti AI is already generating insights.
              </p>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Yukti AI is summarising responses</p>
                <p className="text-xs text-slate-500 mt-0.5">As the community replies, AI will extract key insights, risk level, and recommended next steps.</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  finish();
                  navigate(`/communities/${postResult.communityId}/post/${postResult.postId}`);
                }}
                className="block w-full text-center px-4 py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                View My Question & AI Summary →
              </button>
              <button
                onClick={finish}
                className="block w-full text-center px-4 py-3 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                Explore Communities First
              </button>
            </div>
          </div>
        )}

        {/* Step 6 (skip question): success with just community joins */}
        {step === 6 && !postResult && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Welcome to HealthCircle! 🎉</h2>
            <p className="text-slate-500 text-sm">You've joined your communities. Start exploring!</p>
            <Button onClick={finish} className="bg-primary hover:bg-primary/90 w-full">
              Go to Communities
            </Button>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="px-5 py-4 border-t border-slate-100 bg-white flex-shrink-0 max-w-lg mx-auto w-full">
        {step === 1 && (
          <Button
            onClick={() => setStep(2)}
            disabled={!intent}
            className="w-full bg-primary hover:bg-primary/90 h-12 text-sm font-semibold rounded-xl"
          >
            Continue <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
        {step === 2 && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button
              onClick={() => setStep(3)}
              disabled={selectedSlugs.length === 0}
              className="flex-[2] bg-primary hover:bg-primary/90 h-12 text-sm font-semibold rounded-xl"
            >
              Continue ({selectedSlugs.length} selected) <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
        {step === 3 && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="flex-1 h-12 rounded-xl">Back</Button>
            <Button
              onClick={() => setStep(4)}
              disabled={!consent1 || !consent2}
              className="flex-[2] bg-primary hover:bg-primary/90 h-12 text-sm font-semibold rounded-xl"
            >
              I Agree & Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-2">
            <Button
              onClick={() => { setStep(5); handlePost(); }}
              disabled={!question.trim()}
              className="w-full bg-primary hover:bg-primary/90 h-12 text-sm font-semibold rounded-xl"
            >
              Post My Question <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
            <button
              onClick={async () => {
                // Join communities silently, then skip to done
                setStep(5);
                setPosting(true);
                try {
                  const commRes = await fetch(`${API_BASE}/communities`, { credentials: "include" });
                  if (commRes.ok) {
                    const communities: { id: number; slug: string }[] = await commRes.json();
                    const toJoin = selectedSlugs
                      .map(slug => communities.find(x => x.slug === slug))
                      .filter((c): c is { id: number; slug: string } => !!c);
                    await Promise.allSettled(
                      toJoin.map(c =>
                        fetch(`${API_BASE}/communities/${c.id}/join`, { method: "POST", credentials: "include" })
                      )
                    );
                  }
                } catch (err) {
                  console.error("[onboarding] skip-join failed:", err);
                } finally {
                  setPosting(false);
                  setStep(6);
                }
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
