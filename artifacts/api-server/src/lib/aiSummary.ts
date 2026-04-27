import { db } from "@workspace/db";
import { aiSummariesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface PostAiSummary {
  whatItCouldBe: string;
  riskLevel: "low" | "medium" | "high" | "emergency";
  whatToDo: string;
  whenToSeeDoctor: string;
  disclaimer: string;
}

const EMERGENCY_KEYWORDS = ["chest pain", "can't breathe", "suicidal", "severe bleeding", "unconscious", "stroke", "heart attack"];

export async function generatePostSummary(postId: number, title: string, content: string): Promise<PostAiSummary | null> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) return null;

  const fullText = `${title}\n\n${content}`;
  const isEmergency = EMERGENCY_KEYWORDS.some(k => fullText.toLowerCase().includes(k));

  if (isEmergency) {
    const emergencySummary: PostAiSummary = {
      whatItCouldBe: "The symptoms described may indicate a medical emergency.",
      riskLevel: "emergency",
      whatToDo: "Call emergency services (112) immediately. Do not wait.",
      whenToSeeDoctor: "Seek emergency care RIGHT NOW. Do not delay.",
      disclaimer: "This is an automated alert. Always call emergency services for life-threatening symptoms.",
    };
    await saveSummary(postId, emergencySummary);
    return emergencySummary;
  }

  const prompt = `You are a medical AI assistant. Analyze this health question and respond ONLY as valid JSON.

Question: "${title}"
Details: "${content.slice(0, 500)}"

Respond in this exact JSON format:
{
  "whatItCouldBe": "Brief, simple explanation of what this could be (1-2 sentences, no jargon)",
  "riskLevel": "low|medium|high|emergency",
  "whatToDo": "2-3 concrete, actionable steps the person can take now",
  "whenToSeeDoctor": "Specific signs or timeframe that should trigger a doctor visit",
  "disclaimer": "This summary is for informational purposes only and is not a medical diagnosis. Always consult a qualified healthcare provider."
}`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return null;
    const data = await response.json() as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as Partial<PostAiSummary>;

    const summary: PostAiSummary = {
      whatItCouldBe: parsed.whatItCouldBe ?? "This appears to be a health-related question.",
      riskLevel: (["low", "medium", "high", "emergency"].includes(parsed.riskLevel ?? "") ? parsed.riskLevel : "low") as PostAiSummary["riskLevel"],
      whatToDo: parsed.whatToDo ?? "Monitor symptoms and consult a healthcare provider.",
      whenToSeeDoctor: parsed.whenToSeeDoctor ?? "If symptoms persist or worsen.",
      disclaimer: "This summary is for informational purposes only and is not a medical diagnosis. Always consult a qualified healthcare provider.",
    };

    await saveSummary(postId, summary);
    return summary;
  } catch (err) {
    logger.error({ err }, "AI summary generation failed");
    return null;
  }
}

async function saveSummary(postId: number, summary: PostAiSummary) {
  try {
    await db.insert(aiSummariesTable).values({
      postId,
      whatItCouldBe: summary.whatItCouldBe,
      riskLevel: summary.riskLevel,
      whatToDo: summary.whatToDo,
      whenToSeeDoctor: summary.whenToSeeDoctor,
      disclaimer: summary.disclaimer,
      fullResponse: summary as Record<string, unknown>,
    }).onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "Failed to save AI summary");
  }
}

export async function getPostSummary(postId: number): Promise<PostAiSummary | null> {
  const [row] = await db.select().from(aiSummariesTable).where(eq(aiSummariesTable.postId, postId));
  if (!row) return null;
  return {
    whatItCouldBe: row.whatItCouldBe,
    riskLevel: row.riskLevel as PostAiSummary["riskLevel"],
    whatToDo: row.whatToDo,
    whenToSeeDoctor: row.whenToSeeDoctor,
    disclaimer: row.disclaimer,
  };
}
