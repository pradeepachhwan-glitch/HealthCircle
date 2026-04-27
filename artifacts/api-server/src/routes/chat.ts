import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, doctorConsultationsTable } from "@workspace/db";
import { healthChatSessionsTable, healthChatMessagesTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getHealthAssistantResponse } from "../lib/healthAssistant";
import { detectLanguage } from "../lib/languageDetect";
import { detectEmergency, buildEmergencyResponse } from "../lib/emergencyDetect";
import { logger } from "../lib/logger";

const router = Router();

router.get("/chat/sessions", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const sessions = await db
    .select()
    .from(healthChatSessionsTable)
    .where(eq(healthChatSessionsTable.userId, user.id))
    .orderBy(desc(healthChatSessionsTable.updatedAt))
    .limit(30);

  res.json(sessions);
});

router.post("/chat/sessions", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const [session] = await db
    .insert(healthChatSessionsTable)
    .values({ userId: user.id, title: "New Chat", language: "en" })
    .returning();

  res.json(session);
});

router.get("/chat/sessions/:sessionId/messages", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const sessionId = parseInt(req.params.sessionId);
  const [session] = await db
    .select()
    .from(healthChatSessionsTable)
    .where(eq(healthChatSessionsTable.id, sessionId));

  if (!session || session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const messages = await db
    .select()
    .from(healthChatMessagesTable)
    .where(eq(healthChatMessagesTable.sessionId, sessionId))
    .orderBy(healthChatMessagesTable.createdAt);

  res.json(messages);
});

router.post("/chat/sessions/:sessionId/messages", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const sessionId = parseInt(req.params.sessionId);
  const { message, attachment } = req.body as {
    message?: string;
    attachment?: { url?: string; type?: string; name?: string } | null;
  };

  const trimmedMessage = (message ?? "").trim();
  if (!trimmedMessage && !attachment?.url) {
    res.status(400).json({ error: "Message or attachment is required" }); return;
  }

  const [session] = await db
    .select()
    .from(healthChatSessionsTable)
    .where(eq(healthChatSessionsTable.id, sessionId));

  if (!session || session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const language = detectLanguage(trimmedMessage);

  await db.insert(healthChatMessagesTable).values({
    sessionId,
    role: "user",
    content: trimmedMessage || (attachment ? "(Attachment shared)" : ""),
    attachmentUrl: attachment?.url ?? null,
    attachmentType: attachment?.type ?? null,
    attachmentName: attachment?.name ?? null,
    language,
  });

  // ── Emergency hard-stop ─────────────────────────────────────────────
  // Runs BEFORE the AI call. If the user's message contains an emergency
  // trigger (chest pain, suicidal ideation, severe bleeding, etc.), return
  // a fixed 108/112 response. Never let the LLM soften this.
  const emergency = detectEmergency(trimmedMessage);
  if (emergency) {
    const structured = buildEmergencyResponse(emergency.language);
    const [assistantMsg] = await db
      .insert(healthChatMessagesTable)
      .values({
        sessionId,
        role: "assistant",
        content: structured.reply,
        intent: structured.intent,
        structuredResponse: structured as unknown as Record<string, unknown>,
        language: emergency.language,
      })
      .returning();
    res.json({ userMessage: message, assistantMessage: assistantMsg, structured, emergency: true });
    return;
  }

  const historyRows = await db
    .select()
    .from(healthChatMessagesTable)
    .where(eq(healthChatMessagesTable.sessionId, sessionId))
    .orderBy(healthChatMessagesTable.createdAt);

  const history = historyRows.slice(-12).map(m => ({ role: m.role, content: m.content }));

  try {
    const structured = await getHealthAssistantResponse(
      trimmedMessage || "Please review this image.",
      history.slice(0, -1),
      language,
      attachment?.url && attachment?.type ? { url: attachment.url, type: attachment.type } : null,
    );

    const [assistantMsg] = await db
      .insert(healthChatMessagesTable)
      .values({
        sessionId,
        role: "assistant",
        content: structured.reply,
        intent: structured.intent,
        structuredResponse: structured as Record<string, unknown>,
        language,
      })
      .returning();

    if (session.title === "New Chat" && historyRows.length <= 2) {
      const shortTitle = message.slice(0, 40) + (message.length > 40 ? "…" : "");
      await db
        .update(healthChatSessionsTable)
        .set({ title: shortTitle })
        .where(eq(healthChatSessionsTable.id, sessionId));
    }

    res.json({ userMessage: message, assistantMessage: assistantMsg, structured });
  } catch (err) {
    logger.error({ err }, "Health assistant error");
    res.status(500).json({ error: "AI service unavailable. Please try again." });
  }
});

router.post("/chat/sessions/:sessionId/request-consultation", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  const sessionId = parseInt(req.params.sessionId);
  const { reason, riskLevel } = req.body;

  const [session] = await db.select().from(healthChatSessionsTable).where(eq(healthChatSessionsTable.id, sessionId));
  if (!session || session.userId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

  const existing = await db.select().from(doctorConsultationsTable)
    .where(and(eq(doctorConsultationsTable.chatSessionId, sessionId), eq(doctorConsultationsTable.userId, user.id))).limit(1);
  if (existing.length > 0) {
    res.json({ success: true, consultation: existing[0], alreadyExists: true }); return;
  }

  const [consultation] = await db.insert(doctorConsultationsTable).values({
    userId: user.id,
    chatSessionId: sessionId,
    riskLevel: riskLevel ?? "high",
    reason: reason ?? "User requested professional review from chat",
    status: "pending",
    source: "user_request",
  }).returning();

  res.status(201).json({ success: true, consultation });
});

router.delete("/chat/sessions/:sessionId", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const sessionId = parseInt(req.params.sessionId);
  const [session] = await db
    .select()
    .from(healthChatSessionsTable)
    .where(eq(healthChatSessionsTable.id, sessionId));

  if (!session || session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(healthChatSessionsTable).where(eq(healthChatSessionsTable.id, sessionId));
  res.json({ success: true });
});

export default router;
