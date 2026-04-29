import { Router } from "express";
import { getHealthAssistantResponse } from "../lib/healthAssistant";
import { detectLanguage } from "../lib/languageDetect";
import { detectEmergency, buildEmergencyResponse } from "../lib/emergencyDetect";
import { logger } from "../lib/logger";

const router = Router();

// PUBLIC, unauthenticated landing-page demo of Yukti.
// Rate limited at the express level (publicAiRateLimiter, 5/hr/IP).
// One question, one answer — UI then nudges the visitor to sign up.
router.post("/public/ask", async (req, res) => {
  const { message } = (req.body ?? {}) as { message?: string };
  const trimmed = (message ?? "").trim();

  if (!trimmed || trimmed.length < 3) {
    res.status(400).json({ error: "Please type a health question (at least 3 characters)." });
    return;
  }
  if (trimmed.length > 500) {
    res.status(400).json({ error: "Please keep your demo question under 500 characters." });
    return;
  }

  const language = detectLanguage(trimmed);

  const emergency = detectEmergency(trimmed);
  if (emergency) {
    const structured = buildEmergencyResponse(emergency.language);
    res.json({
      reply: structured.reply,
      summary: structured.summary,
      recommendations: structured.recommendations,
      risk_level: structured.risk_level,
      // "Why this answer?" trust footer fields — for the emergency path we
      // surface the deterministic 108 protocol so the user can see where the
      // hard-stop response is grounded.
      topic_tags: ["emergency", "108 protocol"],
      sources: ["108 emergency triage protocol", "WHO emergency care"],
      emergency: true,
    });
    return;
  }

  try {
    const structured = await getHealthAssistantResponse(trimmed, [], language, null);
    res.json({
      reply: structured.reply,
      summary: structured.summary,
      recommendations: structured.recommendations.slice(0, 3),
      risk_level: structured.risk_level,
      // "Why this answer?" trust footer fields — these are the topics Yukti
      // inferred from the question and the clinical sources it grounded in.
      topic_tags: structured.topic_tags,
      sources: structured.sources,
      emergency: false,
    });
  } catch (err) {
    logger.error({ err }, "Public Yukti error");
    res.status(503).json({ error: "Yukti is busy right now. Please try again in a moment." });
  }
});

export default router;
