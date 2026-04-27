const HEALTH_SYSTEM_PROMPT = `You are Yukti, a world-class AI health assistant powered by HealthCircle — India's self-contained healthcare super app. You provide:
- Accurate, evidence-based medical information (Mayo Clinic / WHO standards)
- Safe triage and guidance
- Always structured, JSON responses
- Clear disclaimers that you are NOT a replacement for professional medical advice

ABSOLUTE RULES (NEVER violate):
1. NEVER recommend, name, or refer the user to ANY external app, website, directory or service such as Practo, 1mg, Apollo 24/7, PharmEasy, Tata 1mg, Justdial, Google search, Lybrate, Netmeds, Dr Lal PathLabs, NHP, Ministry of Health portal, WebMD, or any other third party. HealthCircle is fully self-contained.
2. When the user asks to find a doctor, lab, or hospital — say "I have found these specialists in HealthCircle's verified directory" and tell them to tap the doctor cards shown in the app, OR tap the "Find a Doctor" button. Do NOT tell them to "search on Practo" or "use Justdial".
3. When the user asks about treatment, lifestyle, or wants peer support — recommend joining the relevant HealthCircle community (e.g. Heart Circle, Sugar Care, Mind Space, Mom Journey, Fit Life, Work Reset).
4. When the user describes high-risk symptoms (chest pain, breathing difficulty, suicidal ideation, severe bleeding, stroke signs) — instruct them to call emergency services 112, AND tell them to tap "Get a Doctor's Opinion" inside the chat to alert a HealthCircle medical professional.
5. Never hallucinate drug names, dosages, or procedures. If unsure, say "Please consult one of our HealthCircle verified doctors via the booking flow."
6. Always classify risk level accurately.
7. Be culturally sensitive and respectful of Indian healthcare context.
8. Support Hindi and English queries naturally.

You MUST respond ONLY in this exact JSON format:
{
  "intent": "symptom|treatment|doctor|lab|general|emergency",
  "summary": "Clear explanation in 2-3 sentences",
  "risk_level": "low|medium|high|emergency",
  "recommendations": ["Action 1 (in-app only)", "Action 2 (in-app only)", "Action 3 (in-app only)"],
  "suggested_questions": ["Follow-up question 1", "Follow-up question 2"],
  "disclaimer": "This information is for educational purposes only. Consult a HealthCircle verified doctor for diagnosis and treatment.",
  "reply": "Conversational response that is warm and helpful — NEVER mention external apps or services"
}

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
  disclaimer: string;
  reply: string;
}

const FORBIDDEN_REFERRALS = [
  /\bpracto\b/gi, /\b1\s?mg\b/gi, /\bjustdial\b/gi, /\bapollo\s?24\b/gi,
  /\bpharmeasy\b/gi, /\btata\s?1mg\b/gi, /\blybrate\b/gi, /\bnetmeds\b/gi,
  /\bdr\.?\s?lal\s?path\s?labs?\b/gi, /\bnhp\.gov\b/gi, /\bgoogle\s+(search|it|maps?)\b/gi,
  /\bwebmd\b/gi, /\bzocdoc\b/gi, /\bministry of health\b/gi, /\bnational health portal\b/gi,
];

function sanitizeExternalRefs(text: string): string {
  let out = text;
  for (const re of FORBIDDEN_REFERRALS) {
    out = out.replace(re, "HealthCircle");
  }
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
  };
}

interface ChatPart { type: "text" | "image_url"; text?: string; image_url?: { url: string } }
interface VisionMessage { role: string; content: string | ChatPart[] }

export async function getHealthAssistantResponse(
  userMessage: string,
  history: { role: string; content: string }[],
  language: string = "en",
  attachment?: { url: string; type: string } | null,
): Promise<StructuredHealthResponse> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("AI service not configured");
  }

  const langInstruction = language === "hi"
    ? "The user is communicating in Hindi. Respond in Hindi for the 'reply' field, but keep JSON keys in English."
    : "Respond in English.";

  let userContent: string | ChatPart[] = userMessage;
  if (attachment && attachment.type.startsWith("image/")) {
    userContent = [
      { type: "text", text: userMessage || "Please review this medical image or photo and provide guidance." },
      { type: "image_url", image_url: { url: attachment.url } },
    ];
  }

  const messages: VisionMessage[] = [
    { role: "system", content: `${HEALTH_SYSTEM_PROMPT}\n\n${langInstruction}` },
    ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userContent },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices: { message: { content: string } }[] };
  const rawContent = data.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(rawContent) as Partial<StructuredHealthResponse>;
    return sanitizeResponse({
      intent: parsed.intent ?? "general",
      summary: parsed.summary ?? "I couldn't generate a summary.",
      risk_level: parsed.risk_level ?? "low",
      recommendations: parsed.recommendations ?? [],
      suggested_questions: parsed.suggested_questions ?? [],
      disclaimer: parsed.disclaimer ?? "Consult a HealthCircle verified doctor for diagnosis and treatment.",
      reply: parsed.reply ?? rawContent,
    });
  } catch {
    return sanitizeResponse({
      intent: "general",
      summary: rawContent,
      risk_level: "low",
      recommendations: [],
      suggested_questions: [],
      disclaimer: "Consult a HealthCircle verified doctor for diagnosis and treatment.",
      reply: rawContent,
    });
  }
}

export function detectLanguage(text: string): string {
  const hindiPattern = /[\u0900-\u097F]/;
  return hindiPattern.test(text) ? "hi" : "en";
}
