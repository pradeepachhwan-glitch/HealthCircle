import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { healthChatSessionsTable, healthChatMessagesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getHealthAssistantResponse, detectLanguage } from "../lib/healthAssistant";
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
  const { message } = req.body;

  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" }); return;
  }

  const [session] = await db
    .select()
    .from(healthChatSessionsTable)
    .where(eq(healthChatSessionsTable.id, sessionId));

  if (!session || session.userId !== user.id) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const language = detectLanguage(message);

  await db.insert(healthChatMessagesTable).values({
    sessionId,
    role: "user",
    content: message,
    language,
  });

  const historyRows = await db
    .select()
    .from(healthChatMessagesTable)
    .where(eq(healthChatMessagesTable.sessionId, sessionId))
    .orderBy(healthChatMessagesTable.createdAt);

  const history = historyRows.slice(-12).map(m => ({ role: m.role, content: m.content }));

  try {
    const structured = await getHealthAssistantResponse(message, history.slice(0, -1), language);

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
