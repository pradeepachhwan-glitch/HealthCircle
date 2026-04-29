/**
 * Voice support for Yukti — built on the browser's Web Speech API.
 * No external API key. Works in Chrome, Edge, and Safari (incl. iOS Safari);
 * Firefox does not implement SpeechRecognition, so we feature-detect and
 * gracefully hide the mic UI there.
 *
 * Two parts:
 *   - useVoiceInput()  → speech-to-text hook (mic dictation).
 *   - speak() / cancelSpeech() / pickPreferredVoice() → text-to-speech utilities.
 *
 * Both honour the user's `prefers-reduced-motion` setting via the consumer's
 * UI; the API itself does not animate.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* ---------- Speech-to-text ----------------------------------------------- */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  // Safari/iOS uses the webkit prefix; Chrome/Edge expose both.
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceInputSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export type VoiceLang = "en-IN" | "hi-IN";

export interface UseVoiceInputOptions {
  language?: VoiceLang;
  /**
   * Called as the user speaks. `isFinal=true` indicates the recogniser has
   * committed the phrase (good time to auto-submit).
   */
  onResult: (transcript: string, isFinal: boolean) => void;
  /** Optional: notify the consumer when the recogniser stops on its own. */
  onEnd?: () => void;
  /** Optional: notify on error (e.g., 'not-allowed', 'no-speech', 'network'). */
  onError?: (error: string) => void;
}

export interface VoiceInputApi {
  supported: boolean;
  listening: boolean;
  /** Most recent error code from the API (cleared when start() is called). */
  error: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Hook that wraps the browser SpeechRecognition API into a tiny start/stop
 * surface. Only one instance is active at a time per hook instance.
 */
export function useVoiceInput(opts: UseVoiceInputOptions): VoiceInputApi {
  const { language = "en-IN", onResult, onEnd, onError } = opts;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = isVoiceInputSupported();

  // Keep the latest callbacks accessible inside the long-lived recogniser
  // event handlers without recreating the recogniser on every render.
  const cbRef = useRef({ onResult, onEnd, onError });
  useEffect(() => {
    cbRef.current = { onResult, onEnd, onError };
  }, [onResult, onEnd, onError]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  // Cleanup on unmount — abort any in-flight session so we don't leak the mic.
  useEffect(() => {
    return () => {
      try { recRef.current?.abort(); } catch { /* ignore */ }
      recRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setError("not-supported");
      cbRef.current.onError?.("not-supported");
      return;
    }
    // If something is already listening, stop it first so the new session
    // doesn't compete for the mic.
    try { recRef.current?.abort(); } catch { /* ignore */ }
    setError(null);

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = language;
    r.continuous = false;
    r.interimResults = true;
    r.onstart = () => setListening(true);
    r.onresult = (ev) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t;
        else interim += t;
      }
      const text = (final || interim).trim();
      if (text) cbRef.current.onResult(text, !!final);
    };
    r.onerror = (ev) => {
      setError(ev.error || "unknown");
      cbRef.current.onError?.(ev.error || "unknown");
    };
    r.onend = () => {
      setListening(false);
      cbRef.current.onEnd?.();
    };
    recRef.current = r;
    try {
      r.start();
    } catch (e) {
      // Some browsers throw if start() is called twice in a row.
      setError("start-failed");
      cbRef.current.onError?.("start-failed");
      void e;
    }
  }, [language, supported]);

  return { supported, listening, error, start, stop };
}

/* ---------- Text-to-speech ----------------------------------------------- */

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

let cachedVoices: SpeechSynthesisVoice[] | null = null;

// Persistent listener that invalidates BOTH the voice list and the per-language
// pick cache whenever the OS/browser updates available voices. Without this,
// an early speak() call on Chrome/Safari/iOS could lock in a suboptimal pick
// (or null) before the full voice catalogue had loaded — and the cache would
// then short-circuit every subsequent call, never re-evaluating against the
// now-richer list. Registered exactly once at module init.
let voicesChangedHooked = false;
function ensureVoicesChangedHook(): void {
  if (voicesChangedHooked || !isSpeechSynthesisSupported()) return;
  voicesChangedHooked = true;
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    cachedVoices = window.speechSynthesis.getVoices();
    pickCache.clear();
    loggedPick = false; // re-log so devs see the better voice now in use
  });
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) return resolve([]);
    ensureVoicesChangedHook();
    if (cachedVoices && cachedVoices.length) return resolve(cachedVoices);
    const initial = window.speechSynthesis.getVoices();
    if (initial.length) {
      cachedVoices = initial;
      return resolve(initial);
    }
    // Voices are populated asynchronously on most browsers. Resolve on the
    // first 'voiceschanged' fire, but keep the persistent hook above active
    // so any LATER updates still bust the pick cache.
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler, { once: true });
    // Safety fallback in case the event never fires. We deliberately do NOT
    // store an empty result in the pick cache — pickPreferredVoice() handles
    // empty lists by returning null without caching, so a subsequent call
    // (or the persistent hook above) can re-pick once voices arrive.
    window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 800);
  });
}

/* -------- Yukti's voice persona ------------------------------------------ *
 * Yukti is presented as an Indian woman, so for BOTH English (en-IN) and
 * Hindi (hi-IN) output we prefer voices that are (a) Indian-locale and
 * (b) female. The browser SpeechSynthesisVoice has no gender field, so we
 * select by NAME — fortunately the Indian female voices ship with
 * unmistakable, well-known names on every major platform:
 *
 *   Apple (macOS / iOS Safari):
 *     • Veena   — en-IN female (the iconic Indian English voice)
 *     • Lekha   — hi-IN female
 *
 *   Microsoft (Windows / Edge — both desktop and online "Neural" voices):
 *     • Heera, NeerjaNeural   — en-IN female
 *     • Kalpana, SwaraNeural  — hi-IN female
 *
 *   Google (Chrome / Android):
 *     • "Google English (India)" — en-IN (typically female)
 *     • "Google हिन्दी"           — hi-IN (typically female)
 *
 * We also explicitly EXCLUDE known Indian male voice names so that on
 * platforms where the male voice happens to be returned first by
 * getVoices(), Yukti still sounds female.
 * ------------------------------------------------------------------------ */

const INDIAN_FEMALE_VOICE_NAMES: Record<string, string[]> = {
  "en-IN": [
    "neerja",                  // Microsoft NeerjaNeural (Edge / Azure online)
    "veena",                   // Apple macOS / iOS Safari
    "heera",                   // Microsoft Heera Desktop (Windows)
    "google english (india)",  // Google Chrome / Android default
    "aditi", "raveena", "shruti", "isha",
  ],
  "hi-IN": [
    "swara",                   // Microsoft SwaraNeural (Edge / Azure online)
    "lekha",                   // Apple macOS / iOS Safari
    "kalpana",                 // Microsoft Kalpana Desktop (Windows)
    "google हिन्दी",             // Google Chrome with Devanagari name
    "google hindi",            // Google Chrome with romanised name
    "kiran",
  ],
};

// Use word boundaries so e.g. blacklisting "ravi" does not accidentally
// exclude a hypothetical "Raveena" or "Ravisha". All male voice names are
// matched as whole tokens within the voice's display name.
const MALE_VOICE_NAME_RE = /\b(rishi|ravi|prabhat|hemant|aarav|madhur)\b/i;

function isLikelyMale(name: string): boolean {
  return MALE_VOICE_NAME_RE.test(name);
}

const pickCache: Map<string, SpeechSynthesisVoice | null> = new Map();
let loggedPick = false;

/**
 * Pick the most appropriate voice for the requested language, with a strong
 * preference for an Indian female voice (since Yukti is an Indian woman).
 *
 * Priority order:
 *   1. A voice whose name matches one of the known Indian female voice names
 *      AND whose lang matches (exact or same root).
 *   2. Any voice matching the exact language whose name does NOT look male.
 *   3. Any voice matching the same root language whose name does NOT look male.
 *   4. Any voice matching the language (last-ditch — may be male).
 *
 * Result is cached per-language so subsequent speak() calls don't re-iterate.
 * Exported so consumers / debugging tools can introspect the chosen voice.
 */
export async function pickPreferredVoice(
  lang: string,
): Promise<SpeechSynthesisVoice | null> {
  if (pickCache.has(lang)) return pickCache.get(lang) ?? null;

  const voices = await loadVoices();
  if (!voices.length) {
    // Don't cache the null — once voices populate (via the voiceschanged
    // hook or a later call), we want to re-pick instead of being stuck.
    return null;
  }
  const root = lang.split("-")[0];
  const langMatches = (v: SpeechSynthesisVoice) =>
    v.lang === lang || v.lang.startsWith(root + "-");

  // 1. Known Indian female voice in the requested language.
  const femaleNames = INDIAN_FEMALE_VOICE_NAMES[lang] ?? [];
  for (const fname of femaleNames) {
    const found = voices.find((v) => {
      const nameLc = v.name.toLowerCase();
      return langMatches(v) && nameLc.includes(fname);
    });
    if (found) {
      pickCache.set(lang, found);
      logVoicePick(lang, found, "indian-female-known");
      return found;
    }
  }

  // 2. Any voice matching the exact language whose name does not look male.
  const exactNonMale = voices.find(
    (v) => v.lang === lang && !isLikelyMale(v.name),
  );
  if (exactNonMale) {
    pickCache.set(lang, exactNonMale);
    logVoicePick(lang, exactNonMale, "exact-lang-non-male");
    return exactNonMale;
  }

  // 3. Any voice in the same root language whose name does not look male.
  const rootNonMale = voices.find(
    (v) => v.lang.startsWith(root + "-") && !isLikelyMale(v.name),
  );
  if (rootNonMale) {
    pickCache.set(lang, rootNonMale);
    logVoicePick(lang, rootNonMale, "root-lang-non-male");
    return rootNonMale;
  }

  // 4. Last-ditch fallback (may be male if that's all the OS ships).
  const fallback =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(root + "-")) ??
    voices.find((v) => v.lang === root) ??
    null;
  pickCache.set(lang, fallback);
  if (fallback) logVoicePick(lang, fallback, "fallback");
  return fallback;
}

function logVoicePick(
  lang: string,
  voice: SpeechSynthesisVoice,
  via: string,
): void {
  if (loggedPick || typeof console === "undefined") return;
  // Only the very first pick is logged — keeps the console clean while
  // still letting devs and curious users verify which voice Yukti is using.
  loggedPick = true;
  // eslint-disable-next-line no-console
  console.info(
    `[Yukti voice] ${lang} → "${voice.name}" (${voice.lang}) via ${via}`,
  );
}

/**
 * Pick the right Indian voice language for a Yukti reply by looking at
 * how much of the text is in Devanagari (Hindi) script.
 *
 * Returns "hi-IN" when the reply is Hindi-dominant, otherwise "en-IN".
 *
 * Heuristic — both branches must hold to switch to Hindi:
 *   • either Devanagari makes up > 40% of the alphabetic characters
 *     (clearly a Hindi-led sentence), OR
 *   • there are at least 4 Devanagari characters AND > 15% of the
 *     alphabetic characters are Devanagari (≈ two Hindi words in a
 *     mostly-mixed reply, enough that the English voice would sound
 *     bad reading them).
 *
 * This avoids the failure mode where a single embedded Hindi word
 * (e.g. "Drink water और rest") forces the whole sentence onto the
 * Hindi voice, while still catching genuinely code-mixed replies
 * (e.g. "I think paracetamol is fine, ले लीजिए").
 */
export function detectIndianScript(text: string): "hi-IN" | "en-IN" {
  if (!text) return "en-IN";
  // Devanagari Unicode block: U+0900 – U+097F (covers Hindi, Marathi, Sanskrit).
  const devCount = (text.match(/[\u0900-\u097F]/g) ?? []).length;
  if (devCount === 0) return "en-IN";
  const alphaCount = (text.match(/[\p{L}]/gu) ?? []).length || 1;
  const ratio = devCount / alphaCount;
  const hindiDominant = ratio > 0.4 || (devCount >= 4 && ratio > 0.15);
  return hindiDominant ? "hi-IN" : "en-IN";
}

export interface SpeakOptions {
  lang?: string;
  rate?: number;
  pitch?: number;
  /** Called when speech actually starts (after voice is selected). */
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

/**
 * Speak the given text using the browser's TTS. Cancels any in-flight
 * speech first so successive calls replace each other instead of queueing.
 * Returns immediately; speech happens in the background.
 */
export async function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!isSpeechSynthesisSupported() || !text.trim()) return;
  // If the caller supplied a language, honour it. Otherwise auto-detect:
  // Yukti's replies are sometimes in Devanagari, in which case we should
  // speak with the Hindi voice (otherwise the en-IN voice mispronounces
  // every word). Default fallback is en-IN.
  const lang = opts.lang ?? detectIndianScript(text);
  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  // Slightly slower than 1.0 reads as calmer / more companion-y, which fits
  // Yukti's persona. Pitch is left at the voice's natural value.
  u.rate = opts.rate ?? 0.96;
  u.pitch = opts.pitch ?? 1;
  const voice = await pickPreferredVoice(lang);
  if (voice) u.voice = voice;
  u.onstart = () => opts.onStart?.();
  u.onend = () => opts.onEnd?.();
  u.onerror = () => opts.onError?.();
  // The user may have navigated away while we were resolving voices.
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech(): void {
  if (!isSpeechSynthesisSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}
