const HEALTH_SYSTEM_PROMPT = `You are Yukti, a world-class AI health assistant powered by HealthCircle. You provide:
- Accurate, evidence-based medical information (Mayo Clinic / WHO standards)
- Safe triage and guidance
- Always structured, JSON responses
- Clear disclaimers that you are NOT a replacement for professional medical advice

CRITICAL RULES:
1. Never hallucinate drug names, dosages, or procedures
2. Always classify risk level accurately
3. Recommend emergency services for life-threatening symptoms
4. Be culturally sensitive and respectful
5. Support Hindi and English queries naturally

You MUST respond ONLY in this exact JSON format:
{
  "intent": "symptom|treatment|doctor|lab|general|emergency",
  "summary": "Clear explanation in 2-3 sentences",
  "risk_level": "low|medium|high|emergency",
  "recommendations": ["Action 1", "Action 2", "Action 3"],
  "suggested_questions": ["Follow-up question 1", "Follow-up question 2"],
  "disclaimer": "This information is for educational purposes only. Consult a qualified healthcare provider for diagnosis and treatment.",
  "reply": "Conversational response that is warm and helpful"
}`;

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

export async function getHealthAssistantResponse(
  userMessage: string,
  history: { role: string; content: string }[],
  language: string = "en"
): Promise<StructuredHealthResponse> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("AI service not configured");
  }

  const langInstruction = language === "hi"
    ? "The user is communicating in Hindi. Respond in Hindi for the 'reply' field, but keep JSON keys in English."
    : "Respond in English.";

  const messages = [
    { role: "system", content: `${HEALTH_SYSTEM_PROMPT}\n\n${langInstruction}` },
    ...history.slice(-10),
    { role: "user", content: userMessage },
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
    return {
      intent: parsed.intent ?? "general",
      summary: parsed.summary ?? "I couldn't generate a summary.",
      risk_level: parsed.risk_level ?? "low",
      recommendations: parsed.recommendations ?? [],
      suggested_questions: parsed.suggested_questions ?? [],
      disclaimer: parsed.disclaimer ?? "Consult a qualified healthcare provider for diagnosis and treatment.",
      reply: parsed.reply ?? rawContent,
    };
  } catch {
    return {
      intent: "general",
      summary: rawContent,
      risk_level: "low",
      recommendations: [],
      suggested_questions: [],
      disclaimer: "Consult a qualified healthcare provider for diagnosis and treatment.",
      reply: rawContent,
    };
  }
}

export function detectLanguage(text: string): string {
  const hindiPattern = /[\u0900-\u097F]/;
  return hindiPattern.test(text) ? "hi" : "en";
}
