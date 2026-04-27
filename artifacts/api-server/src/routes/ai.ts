import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

router.post("/ai/chat", requireAuth, async (req, res) => {
  const { message, communityId, communityName, history } = req.body;

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    res.status(503).json({ reply: "AI service not configured.", communityContext: null });
    return;
  }

  const communityContext = communityName
    ? `You are Yukti, an expert AI assistant for the "${communityName}" healthcare community on AskHealth AI. Your specialty is health operations, clinical workflows, and healthcare administration topics specifically relevant to ${communityName}. Be precise, professional, and supportive.`
    : "You are Yukti, an expert AI assistant for AskHealth AI — a healthcare community platform. Your specialty is health operations, clinical workflows, and healthcare administration. Be precise, professional, and supportive.";

  const messages = [
    { role: "system", content: communityContext },
    ...(history ?? []).map((h: { role: string; content: string }) => ({
      role: h.role,
      content: h.content,
    })),
    { role: "user", content: message },
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error({ err, status: response.status }, "Yukti AI error");
      res.status(500).json({ reply: "Sorry, I'm having trouble connecting right now. Please try again.", communityContext: null });
      return;
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const reply = data.choices[0]?.message?.content ?? "I couldn't generate a response.";

    res.json({ reply, communityContext: communityName ?? null });
  } catch (err) {
    logger.error({ err }, "Yukti AI fetch error");
    res.status(500).json({ reply: "Sorry, I'm unable to respond right now.", communityContext: null });
  }
});

export default router;
