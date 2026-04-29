import { aiChat } from "./aiClient";
import { detectLanguage as detectLang, languageInstructionForAI, type SupportedLanguage } from "./languageDetect";
import { buildCommunitySystemPrompt } from "./communityPrompts";

// Generic Yukti persona — used when no community context is attached.
const HEALTH_PERSONA_BASE = `You are Yukti, a world-class AI health assistant powered by HealthCircle — India's self-contained healthcare super app. You provide:
- Accurate, evidence-based medical information (Mayo Clinic / WHO standards)
- Safe triage and guidance
- Always structured, JSON responses
- Clear disclaimers that you are NOT a replacement for professional medical advice`;

// Safety rules + structured-response contract. ALWAYS appended to whatever
// persona is selected (generic or community-specific) so the JSON shape and
// no-external-referral guarantees never get accidentally dropped when
// Yukti is acting on behalf of a community.
const HEALTH_RULES_AND_FORMAT = `ABSOLUTE RULES (NEVER violate):
1. NEVER recommend, name, or refer the user to ANY external app, website, directory or service such as Practo, 1mg, Apollo 24/7, PharmEasy, Tata 1mg, Justdial, Google search, Lybrate, Netmeds, Dr Lal PathLabs, NHP, Ministry of Health portal, WebMD, or any other third party. HealthCircle is fully self-contained.
2. When the user asks to find a doctor, lab, or hospital — say "I have found these specialists in HealthCircle's verified directory" and tell them to tap the doctor cards shown in the app, OR tap the "Find a Doctor" button. Do NOT tell them to "search on Practo" or "use Justdial".
3. When the user asks about treatment, lifestyle, or wants peer support — recommend joining the relevant HealthCircle community (e.g. Heart Circle, Sugar Care, Mind Space, Mom Journey, Fit Life, Work Reset).
4. When the user describes high-risk symptoms (chest pain, breathing difficulty, suicidal ideation, severe bleeding, stroke signs) — instruct them to call emergency services 108, AND tell them to tap "Get a Doctor's Opinion" inside the chat to alert a HealthCircle medical professional.
5. Never hallucinate drug names, dosages, or procedures. If unsure, say "Please consult one of our HealthCircle verified doctors via the booking flow."
6. Always classify risk level accurately.
7. Be culturally sensitive and respectful of Indian healthcare context.
8. Support Hindi, Hinglish, Bengali, Tamil, Telugu, Marathi, Gujarati, Punjabi, Kannada, Malayalam and English queries naturally — reply in the SAME script the user typed in.

You MUST respond ONLY in this exact JSON format (no markdown fences, no prose outside JSON):
{
  "intent": "symptom|treatment|doctor|lab|general|emergency",
  "summary": "Clear explanation in 2-3 sentences",
  "risk_level": "low|medium|high|emergency",
  "recommendations": ["Action 1 (in-app only)", "Action 2 (in-app only)", "Action 3 (in-app only)"],
  "suggested_questions": ["Follow-up question 1", "Follow-up question 2"],
  "topic_tags": ["short topic 1", "short topic 2"],
  "sources": ["Mayo Clinic", "WHO guidelines"],
  "disclaimer": "This information is for educational purposes only. Consult a HealthCircle verified doctor for diagnosis and treatment.",
  "reply": "Conversational response that is warm and helpful — NEVER mention external apps or services"
}

FIELD RULES:
- "topic_tags": 1–4 SHORT (1–3 word) topic descriptors that capture what the user is really asking about (examples: "sleep", "anxiety", "diabetes diet", "PCOS", "child fever", "blood pressure"). These power the "Why this answer?" trust footer the user sees in the UI — keep them concrete and specific to the question.
- "sources": 1–4 SHORT names of the evidence categories you drew from. Use ONLY trusted clinical references like: "Mayo Clinic", "WHO guidelines", "CDC", "NIH", "ICMR guidelines", "AHA (American Heart Association)", "ADA (American Diabetes Association)", "FOGSI guidelines", "IAP guidelines", "NICE guidelines", "Cochrane reviews". NEVER list random websites, blogs, or third-party apps.

CRITICAL: All actions in "recommendations" MUST be things the user can do INSIDE HealthCircle:
- "Browse our verified doctors directory" / "Tap a specialist card to book"
- "Open the Find Doctor button below to book a consultation"
- "Join the [Community Name] community on HealthCircle"
- "Tap 'Get a Doctor's Opinion' to alert a HealthCircle medical professional"
- "Use HealthCircle Search for nearby clinics on the map"
- "Schedule an appointment from the Appointments page"
NEVER write things like "search on Practo", "check 1mg", "use Justdial", "Google search this", "visit NHP".`;

export type HealthIntent = "symptom" | "treatment" | "doctor" | "lab" | "general" | "emergency";
export type RiskLevel = "low" | "medium" | "high" | "emergency";

export interface StructuredHealthResponse {
  intent: HealthIntent;
  summary: string;
  risk_level: RiskLevel;
  recommendations: string[];
  suggested_questions: string[];
  /** 1–4 short topic descriptors the AI inferred from the user's question.
   *  Powers the "Why this answer?" trust footer in the UI. */
  topic_tags: string[];
  /** 1–4 short clinical-source names the answer is grounded in (e.g.
   *  "Mayo Clinic", "WHO guidelines"). Surfaced in the same trust footer. */
  sources: string[];
  disclaimer: string;
  reply: string;
}

const TRUSTED_SOURCE_ALLOWLIST = new Set([
  "mayo clinic", "who", "who guidelines", "cdc", "nih", "icmr",
  "icmr guidelines", "aha", "american heart association", "ada",
  "american diabetes association", "fogsi", "fogsi guidelines",
  "iap", "iap guidelines", "nice", "nice guidelines", "cochrane",
  "cochrane reviews",
]);

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (t.length === 0 || t.length > 40) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    cleaned.push(t);
    if (cleaned.length >= 4) break;
  }
  return cleaned;
}

// Permitted qualifier words that may follow a trusted source name. This keeps
// "Mayo Clinic sleep research" or "WHO guidelines on diabetes" valid while
// rejecting injected prose like "WHO: unofficial blog" or "Mayo Clinic is wrong".
const SOURCE_QUALIFIER_RE = /^(guidelines?|research|recommendations?|reviews?|advisory|consensus|stud(y|ies)|trials?|protocol|protocols|standards?|criteria|reports?|on|for)(\s|$)/;

function sanitizeSources(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of sources) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (s.length === 0 || s.length > 60) continue;
    const k = s.toLowerCase().replace(/[()]/g, "").trim();
    let allowedHere = false;
    for (const allowed of TRUSTED_SOURCE_ALLOWLIST) {
      if (k === allowed) { allowedHere = true; break; }
      if (k.startsWith(allowed + " ")) {
        // The trailing fragment after the trusted name must be a clinical
        // qualifier (e.g. "guidelines", "research") — not arbitrary prose.
        const tail = k.slice(allowed.length + 1).trim();
        if (SOURCE_QUALIFIER_RE.test(tail)) { allowedHere = true; break; }
      }
    }
    if (!allowedHere) continue;
    const dedupeKey = k;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    cleaned.push(s);
    if (cleaned.length >= 4) break;
  }
  return cleaned;
}

const FORBIDDEN_REFERRALS = [
  /\bpracto\b/gi, /\b1\s?mg\b/gi, /\bjustdial\b/gi, /\bapollo\s?24\b/gi,
  /\bpharmeasy\b/gi, /\btata\s?1mg\b/gi, /\blybrate\b/gi, /\bnetmeds\b/gi,
  /\bdr\.?\s?lal\s?path\s?labs?\b/gi, /\bnhp\.gov\b/gi, /\bgoogle\s+(search|it|maps?)\b/gi,
  /\bwebmd\b/gi, /\bzocdoc\b/gi, /\bministry of health\b/gi, /\bnational health portal\b/gi,
];

function sanitizeExternalRefs(text: string): string {
  let out = text;
  for (const re of FORBIDDEN_REFERRALS) out = out.replace(re, "HealthCircle");
  out = out.replace(/(use|check|search on|visit|go to)\s+HealthCircle/gi, "use HealthCircle");
  return out;
}

function sanitizeResponse(r: StructuredHealthResponse): StructuredHealthResponse {
  return {
    ...r,
    summary: sanitizeExternalRefs(r.summary),
    reply: sanitizeExternalRefs(r.reply),
    recommendations: r.recommendations.map(sanitizeExternalRefs),
    suggested_questions: r.suggested_questions.map(sanitizeExternalRefs),
    topic_tags: r.topic_tags.map(sanitizeExternalRefs),
    sources: r.sources.map(sanitizeExternalRefs),
  };
}

export interface HealthAssistantOptions {
  /** Community slug from `communities` table — when provided, swaps the
   *  generic Yukti persona for the matching specialist persona while keeping
   *  the safety rules and JSON contract intact. */
  communitySlug?: string | null;
  /** Display name for the community persona. Required alongside slug for
   *  the persona swap to take effect. */
  communityName?: string | null;
}

export async function getHealthAssistantResponse(
  userMessage: string,
  history: { role: string; content: string }[],
  language: SupportedLanguage | string = "en",
  attachment?: { url: string; type: string } | null,
  options: HealthAssistantOptions = {},
): Promise<StructuredHealthResponse> {
  // Normalize the language tag — accept legacy "en"/"hi" or our richer SupportedLanguage codes.
  const lang = (language as SupportedLanguage) ?? "en";
  const langInstruction = languageInstructionForAI(lang);

  // Persona selection: community-specific persona if both slug + name are
  // present, otherwise the generic Yukti persona. Safety rules + JSON contract
  // are appended unconditionally so they can never be lost in customisation.
  const persona = options.communitySlug && options.communityName
    ? buildCommunitySystemPrompt(options.communitySlug, options.communityName)
    : HEALTH_PERSONA_BASE;
  const systemPrompt = `${persona}\n\n${HEALTH_RULES_AND_FORMAT}\n\n${langInstruction}`;

  const result = await aiChat({
    systemPrompt,
    userPrompt: userMessage || "Please review this medical image or photo and provide guidance.",
    history,
    attachment: attachment ?? null,
    timeoutMs: 12000,
    maxTokens: 800,
    jsonMode: true,
  });

  if (!result.ok) {
    throw new Error(`AI service unavailable: ${result.error}`);
  }

  let parsed: Partial<StructuredHealthResponse> = {};
  try {
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned) as Partial<StructuredHealthResponse>;
  } catch {
    // Model returned non-JSON — wrap the raw text into a safe fallback object.
    return sanitizeResponse({
      intent: "general",
      summary: result.text.slice(0, 300),
      risk_level: "low",
      recommendations: [],
      suggested_questions: [],
      topic_tags: [],
      sources: [],
      disclaimer: "Consult a HealthCircle verified doctor for diagnosis and treatment.",
      reply: result.text,
    });
  }

  return sanitizeResponse({
    intent: parsed.intent ?? "general",
    summary: parsed.summary ?? "I couldn't generate a summary.",
    risk_level: parsed.risk_level ?? "low",
    recommendations: parsed.recommendations ?? [],
    suggested_questions: parsed.suggested_questions ?? [],
    topic_tags: sanitizeTags(parsed.topic_tags),
    sources: sanitizeSources(parsed.sources),
    disclaimer: parsed.disclaimer ?? "Consult a HealthCircle verified doctor for diagnosis and treatment.",
    reply: parsed.reply ?? "I'm here to help. Please share a bit more detail.",
  });
}

/**
 * Backward-compatible language detector — returns the new SupportedLanguage
 * codes (en, hi, hi-Latn, bn, ta, te, mr, gu, pa, kn, ml, ur). Older callers
 * that compared against "en"/"hi" still work; the new richer codes flow into
 * the AI prompt for proper multi-language replies.
 */
export function detectLanguage(text: string): SupportedLanguage {
  return detectLang(text);
}
