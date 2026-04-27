/**
 * Multi-language + multi-script detector for HealthCircle.
 *
 * Detects the user's input language across:
 * - English (en)
 * - Hindi — Devanagari script (hi)
 * - Hinglish — Hindi written in Roman/Latin script (hi-Latn)
 * - Bengali (bn), Tamil (ta), Telugu (te), Marathi (mr — also Devanagari),
 *   Gujarati (gu), Punjabi (pa), Kannada (kn), Malayalam (ml), Urdu (ur)
 *
 * Uses Unicode block ranges for Indic scripts and a small Hinglish
 * keyword lexicon for Roman-Hindi (since it overlaps the English alphabet).
 *
 * Returns the primary detected language. For BCP 47 / browser speech APIs,
 * use `toBcp47(lang)` to get codes like "hi-IN" / "ta-IN" / "en-IN".
 */

export type SupportedLanguage =
  | "en"
  | "hi"        // Hindi (Devanagari)
  | "hi-Latn"   // Hindi in Roman script (Hinglish)
  | "bn"        // Bengali
  | "ta"        // Tamil
  | "te"        // Telugu
  | "mr"        // Marathi (Devanagari, distinct from Hindi by lexicon — best-effort)
  | "gu"        // Gujarati
  | "pa"        // Punjabi (Gurmukhi)
  | "kn"        // Kannada
  | "ml"        // Malayalam
  | "ur";       // Urdu (Arabic script)

const SCRIPT_RANGES: { lang: SupportedLanguage; re: RegExp }[] = [
  { lang: "bn", re: /[\u0980-\u09FF]/ },  // Bengali block
  { lang: "ta", re: /[\u0B80-\u0BFF]/ },  // Tamil block
  { lang: "te", re: /[\u0C00-\u0C7F]/ },  // Telugu block
  { lang: "gu", re: /[\u0A80-\u0AFF]/ },  // Gujarati block
  { lang: "pa", re: /[\u0A00-\u0A7F]/ },  // Gurmukhi (Punjabi) block
  { lang: "kn", re: /[\u0C80-\u0CFF]/ },  // Kannada block
  { lang: "ml", re: /[\u0D00-\u0D7F]/ },  // Malayalam block
  { lang: "ur", re: /[\u0600-\u06FF]/ },  // Arabic block (Urdu)
  { lang: "hi", re: /[\u0900-\u097F]/ },  // Devanagari (Hindi/Marathi default → Hindi)
];

// Roman-Hindi keyword lexicon (case-insensitive). If at least 2 of these
// appear in mostly-Latin text, classify as Hinglish.
const HINGLISH_TOKENS = [
  "hai", "hain", "kya", "nahi", "nahin", "main", "mera", "meri", "mujhe", "mujhko",
  "tum", "tumhare", "aap", "aapka", "aapki", "kaisa", "kaise", "kaisi",
  "kyun", "kyon", "kyu", "kuch", "kuchh", "ho gaya", "ho raha", "raha hai",
  "rahi hai", "lagta", "lag raha", "dard", "bukhar", "khansi", "sardi",
  "pareshan", "tabiyat", "ilaaj", "dawa", "doctor sahab", "ji haan", "ji nahin",
  "bahut", "thoda", "zyada", "kam", "achha", "accha", "theek", "thik",
];

const MARATHI_TOKENS = [
  /\bआहे\b/, /\bआहेत\b/, /\bतुम्ही\b/, /\bआम्ही\b/, /\bमला\b/, /\bतुला\b/, /\bतुझ्या\b/,
];

export function detectLanguage(text: string): SupportedLanguage {
  if (!text) return "en";
  const trimmed = text.trim();
  if (!trimmed) return "en";

  // Pass 1 — script-based detection (definitive for non-Latin scripts)
  for (const { lang, re } of SCRIPT_RANGES) {
    if (re.test(trimmed)) {
      // Inside Devanagari, distinguish Marathi from Hindi via lexicon
      if (lang === "hi" && MARATHI_TOKENS.some(re => re.test(trimmed))) return "mr";
      return lang;
    }
  }

  // Pass 2 — Hinglish detection on Latin-only text
  const lower = trimmed.toLowerCase();
  let hits = 0;
  for (const tok of HINGLISH_TOKENS) {
    if (lower.includes(tok)) {
      hits++;
      if (hits >= 2) return "hi-Latn";
    }
  }
  if (hits === 1 && /\b(ji|na|kya|hai|nahi)\b/.test(lower)) return "hi-Latn";

  return "en";
}

/** BCP 47 code for browser speech APIs (Web Speech, SpeechRecognition). */
export function toBcp47(lang: SupportedLanguage): string {
  const map: Record<SupportedLanguage, string> = {
    en: "en-IN",
    hi: "hi-IN",
    "hi-Latn": "hi-IN",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    pa: "pa-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    ur: "ur-IN",
  };
  return map[lang];
}

/** Human label for UI badges. */
export function languageLabel(lang: SupportedLanguage): string {
  const map: Record<SupportedLanguage, string> = {
    en: "English",
    hi: "हिन्दी",
    "hi-Latn": "Hinglish",
    bn: "বাংলা",
    ta: "தமிழ்",
    te: "తెలుగు",
    mr: "मराठी",
    gu: "ગુજરાતી",
    pa: "ਪੰਜਾਬੀ",
    kn: "ಕನ್ನಡ",
    ml: "മലയാളം",
    ur: "اُردُو",
  };
  return map[lang];
}

/**
 * Get a short instruction string to inject into an AI system prompt so the
 * model replies in the user's language. Hinglish-aware: if user writes Roman
 * Hindi, reply in Roman Hindi (NOT Devanagari) — that's what they'll read.
 */
export function languageInstructionForAI(lang: SupportedLanguage): string {
  switch (lang) {
    case "hi": return "Respond ONLY in Hindi (Devanagari script — हिन्दी). Use simple, warm, everyday Hindi.";
    case "hi-Latn": return "Respond in Hinglish — Hindi written in Roman/English letters (e.g. 'aap kaise hain', NOT 'आप कैसे हैं'). Mix English medical terms where natural.";
    case "bn": return "Respond ONLY in Bengali (বাংলা). Use simple, everyday Bengali.";
    case "ta": return "Respond ONLY in Tamil (தமிழ்). Use simple, everyday Tamil.";
    case "te": return "Respond ONLY in Telugu (తెలుగు). Use simple, everyday Telugu.";
    case "mr": return "Respond ONLY in Marathi (मराठी). Use simple, everyday Marathi.";
    case "gu": return "Respond ONLY in Gujarati (ગુજરાતી). Use simple, everyday Gujarati.";
    case "pa": return "Respond ONLY in Punjabi (ਪੰਜਾਬੀ). Use simple, everyday Punjabi.";
    case "kn": return "Respond ONLY in Kannada (ಕನ್ನಡ). Use simple, everyday Kannada.";
    case "ml": return "Respond ONLY in Malayalam (മലയാളം). Use simple, everyday Malayalam.";
    case "ur": return "Respond ONLY in Urdu (اُردُو). Use simple, everyday Urdu.";
    case "en":
    default: return "Respond in clear, simple English suitable for an Indian audience.";
  }
}
