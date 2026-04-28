import { Router } from "express";
import { getAuth } from "../lib/auth";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { checkQuota, consumeQuota } from "../lib/quota";
import { logger } from "../lib/logger";
import { buildCommunitySystemPrompt, getCommunitySuggestedQuestions } from "../lib/communityPrompts";

const router = Router();

const GENERAL_SYSTEM_PROMPT = `You are Yukti, an expert AI health assistant on HealthCircle — India's trusted healthcare community platform. You provide:
- Accurate, evidence-based health information (WHO, ICMR, major Indian clinical guidelines)
- Safe triage: you clearly identify when symptoms need emergency care
- Culturally sensitive guidance for Indian patients and healthcare contexts
- Bilingual support: respond in Hindi or English based on what the user uses
- Warm, empathetic communication without judgment

CRITICAL RULES:
1. Never hallucinate drug names, dosages, or clinical procedures
2. Always classify risk appropriately — for emergencies, direct to 112 or nearest hospital immediately
3. You are NOT a replacement for a doctor. Always recommend professional consultation for diagnosis and treatment
4. Be sensitive to Indian cultural contexts: vegetarian diet, family dynamics, affordability, government health schemes`;

router.post("/ai/chat", requireAuth, async (req, res) => {
  const { message, communitySlug, communityName, history } = req.body;

  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const quota = await checkQuota(user.id);
  if (!quota.allowed) {
    res.status(429).json({
      error: "quota_exceeded",
      message: `You've reached your ${quota.exceeded} AI question limit.`,
      quota,
    });
    return;
  }

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    res.status(503).json({ reply: "AI service not configured.", communityContext: null });
    return;
  }

  const systemPrompt = communitySlug && communityName
    ? buildCommunitySystemPrompt(communitySlug, communityName)
    : communityName
    ? `You are Yukti, an expert AI health assistant for the "${communityName}" community on HealthCircle. ${GENERAL_SYSTEM_PROMPT}`
    : GENERAL_SYSTEM_PROMPT;

  const messages = [
    { role: "system", content: systemPrompt },
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
        model: "gpt-4o-mini",
        messages,
        max_tokens: 700,
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

    // Only count successful AI calls toward quota.
    await consumeQuota(user.id);

    res.json({ reply, communityContext: communityName ?? null, communitySlug: communitySlug ?? null });
  } catch (err) {
    logger.error({ err }, "Yukti AI fetch error");
    res.status(500).json({ reply: "Sorry, I'm unable to respond right now. Please try again.", communityContext: null });
  }
});

router.get("/ai/community-prompts/:slug", (req, res) => {
  const { slug } = req.params;
  const questions = getCommunitySuggestedQuestions(slug);
  res.json({ slug, suggestedQuestions: questions });
});

export default router;
