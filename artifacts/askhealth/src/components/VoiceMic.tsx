import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mic, MicOff, Loader2, Volume2, Square } from "lucide-react";
import {
  useVoiceInput,
  isVoiceInputSupported,
  isSpeechSynthesisSupported,
  speak,
  cancelSpeech,
  type VoiceLang,
} from "@/lib/voice";

/** Imperative handle so parents can programmatically trigger mic start/stop
 *  (e.g. the floating "voice" pill kicks off dictation in the embedded demo). */
export interface VoiceMicHandle {
  start: () => void;
  stop: () => void;
  listening: boolean;
}

/**
 * Reusable mic button that captures speech and streams the transcript via
 * `onTranscript`. When a final phrase is committed (the recogniser believes
 * the user has stopped speaking), `onFinal` fires — typical use is to
 * auto-submit the form there.
 *
 * Renders nothing if the browser does not support SpeechRecognition (Firefox).
 *
 * Visual states:
 *  - idle:       outlined mic, hover lifts colour to the accent
 *  - listening:  filled rose with a pulsing ring (pressing again stops it)
 *  - error:      shows MicOff with a tooltip explaining the cause
 */
export interface VoiceMicProps {
  language?: VoiceLang;
  onTranscript: (text: string) => void;
  /** Called when the recogniser commits a final phrase (good time to submit). */
  onFinal?: (text: string) => void;
  /** Disable the button (e.g. while the consumer is awaiting an API reply). */
  disabled?: boolean;
  /** Visual size — `md` for input rows, `lg` for hero/floating widgets. */
  size?: "sm" | "md" | "lg";
  /** Optional extra classes for the outer button. */
  className?: string;
  /** Optional aria-label override (default: "Speak your question"). */
  label?: string;
  /** Optional test id. */
  testId?: string;
}

const SIZE_MAP = {
  sm: { btn: "w-9 h-9", icon: "h-4 w-4" },
  md: { btn: "w-11 h-11", icon: "h-4.5 w-4.5" },
  lg: { btn: "w-14 h-14", icon: "h-5 w-5" },
} as const;

export const VoiceMic = forwardRef<VoiceMicHandle, VoiceMicProps>(function VoiceMic(
  {
    language = "en-IN",
    onTranscript,
    onFinal,
    disabled,
    size = "md",
    className = "",
    label = "Speak your question",
    testId = "voice-mic",
  },
  ref,
) {
  const reduce = useReducedMotion();
  const { supported, listening, error, start, stop } = useVoiceInput({
    language,
    onResult: (text, isFinal) => {
      onTranscript(text);
      if (isFinal) onFinal?.(text);
    },
  });

  // Expose imperative start/stop so parents can drive the mic (e.g. from a
  // floating "voice" pill that lives outside this component).
  useImperativeHandle(ref, () => ({ start, stop, listening }), [start, stop, listening]);

  // Stop listening if the consumer disables us mid-session.
  useEffect(() => {
    if (disabled && listening) stop();
  }, [disabled, listening, stop]);

  // Hard-hide on unsupported browsers so the consumer doesn't need to branch.
  if (!supported) return null;

  const sizing = SIZE_MAP[size];

  // Friendly tooltip text per error code.
  const errorTitle =
    error === "not-allowed"
      ? "Microphone permission was denied. Allow it in your browser settings to speak."
      : error === "no-speech"
      ? "I didn't catch that — tap and try again."
      : error === "audio-capture"
      ? "No microphone detected on this device."
      : error === "network"
      ? "Voice service couldn't reach the network. Try again."
      : error
      ? "Voice didn't start. Tap to retry."
      : "";

  const baseClasses = [
    sizing.btn,
    "relative inline-flex items-center justify-center rounded-full transition-all duration-200",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2",
    listening
      ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/40 ring-1 ring-white/40"
      : error
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-rose-600 hover:ring-rose-300 hover:bg-rose-50/60 shadow-sm",
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
    className,
  ].join(" ");

  const handleClick = () => {
    if (disabled) return;
    if (listening) stop();
    else start();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={listening ? "Stop listening" : label}
      aria-pressed={listening}
      title={errorTitle || (listening ? "Stop listening" : label)}
      data-testid={testId}
      className={baseClasses}
    >
      {/* Pulsing halo while listening — purely decorative */}
      {listening && !reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-rose-400"
          animate={{ scale: [1, 1.5, 1.8], opacity: [0.45, 0.1, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {disabled ? (
        <Loader2 className={`${sizing.icon} animate-spin`} strokeWidth={2} />
      ) : error ? (
        <MicOff className={sizing.icon} strokeWidth={2} />
      ) : (
        <Mic className={sizing.icon} strokeWidth={2.25} />
      )}
    </button>
  );
});

/* ----------------------------------------------------------------------- */

/**
 * Companion "Listen" button for replaying a Yukti answer aloud via the
 * browser's speech synthesis. Hides itself when SpeechSynthesis isn't
 * available. Toggles between Speak ⇄ Stop.
 */
export interface SpeakButtonProps {
  /** The text to speak. Empty string disables the button. */
  text: string;
  /**
   * Optional explicit language override. When omitted, speak() auto-detects
   * the language from the text (Devanagari → hi-IN, otherwise en-IN).
   * Pass an explicit value only when you know the language up-front and
   * want to force it (e.g., a UI labelled "Listen in Hindi").
   */
  language?: VoiceLang;
  className?: string;
  testId?: string;
  /** Optional explicit label override (default: "Listen" / "Stop"). */
  label?: string;
}

export function SpeakButton({
  text,
  language,
  className = "",
  testId = "speak-button",
  label,
}: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  // Stop on unmount so the user doesn't hear a stray voice after navigating.
  useEffect(() => {
    return () => {
      if (speaking) cancelSpeech();
    };
  }, [speaking]);

  if (!isSpeechSynthesisSupported()) return null;
  const disabled = !text.trim();

  const handle = () => {
    if (disabled) return;
    if (speaking) {
      cancelSpeech();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    // Only forward `lang` if the consumer explicitly set it; otherwise let
    // speak() auto-detect Devanagari-vs-Latin so the right Indian female
    // voice is used (Veena/Heera/Neerja for English, Lekha/Kalpana/Swara
    // for Hindi).
    void speak(text, {
      ...(language ? { lang: language } : {}),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const idleLabel = label ?? "Listen";
  const activeLabel = "Stop";

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      aria-label={speaking ? activeLabel : idleLabel}
      aria-pressed={speaking}
      data-testid={testId}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
        speaking
          ? "bg-rose-100 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-200"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-rose-600 hover:ring-rose-300",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      ].join(" ")}
    >
      {speaking ? (
        <>
          <Square className="h-3 w-3 fill-current" strokeWidth={2.5} />
          {activeLabel}
        </>
      ) : (
        <>
          <Volume2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          {idleLabel}
        </>
      )}
    </button>
  );
}

export { isVoiceInputSupported };
