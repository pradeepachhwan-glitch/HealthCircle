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
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) return resolve([]);
    if (cachedVoices && cachedVoices.length) return resolve(cachedVoices);
    const initial = window.speechSynthesis.getVoices();
    if (initial.length) {
      cachedVoices = initial;
      return resolve(initial);
    }
    // Voices are populated asynchronously on most browsers.
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler, { once: true });
    // Safety fallback in case the event never fires.
    window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 800);
  });
}

/**
 * Pick the most appropriate voice for the requested language, preferring an
 * exact regional match (e.g., 'en-IN') and falling back to the same root.
 */
async function pickPreferredVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadVoices();
  if (!voices.length) return null;
  const root = lang.split("-")[0];
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(root + "-")) ??
    voices.find((v) => v.lang === root) ??
    null
  );
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
  const lang = opts.lang ?? "en-IN";
  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = opts.rate ?? 1;
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
