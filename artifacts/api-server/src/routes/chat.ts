import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, doctorConsultationsTable } from "@workspace/db";
import { healthChatSessionsTable, healthChatMessagesTable } from "@workspace/db/schema";
import { eq, desc, and, isNull, gt } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { getHealthAssistantResponse } from "../lib/healthAssistant";
import { detectLanguage } from "../lib/languageDetect";
import { detectEmergency, buildEmergencyResponse } from "../lib/emergencyDetect";
import { checkQuota, consumeQuota } from "../lib/quota";
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

  // ── Emergency hard-stop ─────────────────────────────────────────────
  // Emergencies bypass quota. We detect first so we can decide whether
  // to enforce quota before persisting the user's message (avoiding
  // orphan messages on 429).
  const emergency = detectEmergency(trimmedMessage);

  if (!emergency) {
    const quotaPreview = await checkQuota(user.id);
    if (!quotaPreview.allowed) {
      res.status(429).json({
        error: "quota_exceeded",
        message: `You've reached your ${quotaPreview.exceeded} AI question limit.`,
        quota: quotaPreview,
      });
      return;
    }
  }

  await db.insert(healthChatMessagesTable).values({
    sessionId,
    role: "user",
    content: trimmedMessage || (attachment ? "(Attachment shared)" : ""),
    attachmentUrl: attachment?.url ?? null,
    attachmentType: attachment?.type ?? null,
    attachmentName: attachment?.name ?? null,
    language,
  });
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

  // ── Per-user quota check (4/day, 15/week, 50/month; subscribers bypass) ──
  const quota = await checkQuota(user.id);
  if (!quota.allowed) {
    res.status(429).json({
      error: "quota_exceeded",
      message: `You've reached your ${quota.exceeded} AI question limit.`,
      quota,
    });
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
    // Only count successful AI calls toward quota.
    await consumeQuota(user.id);

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

// Yukti chat is a stateless side-panel chatbot — there's no session row to
// pin a consultation to. This endpoint lets the patient escalate any Yukti
// thread to a human medical professional. The full transcript is stuffed
// into `reason` so the medpro reviewing the request has the complete AI
// conversation to read, edit, approve, or reject.
router.post("/chat/yukti/request-consultation", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { transcript, riskLevel, communityName } = req.body as {
    transcript?: Array<{ role: "user" | "assistant"; content: string }>;
    riskLevel?: "low" | "medium" | "high" | "emergency";
    communityName?: string;
  };

  if (!Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: "transcript is required" }); return;
  }

  // Trim transcript defensively so a runaway chat can't blow up the row.
  // Keep the last 30 messages; truncate each to 2 KB.
  const trimmed = transcript.slice(-30).map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: String(m.content ?? "").slice(0, 2000),
  }));

  const header = `Patient escalated a Yukti AI chat${communityName ? ` from "${communityName}"` : ""} for medical professional review. Please verify, edit, approve or reject the AI responses below.`;
  const transcriptText = trimmed
    .map(m => `${m.role === "user" ? "👤 Patient" : "🤖 Yukti AI"}: ${m.content}`)
    .join("\n\n");
  const reason = `${header}\n\n--- TRANSCRIPT ---\n${transcriptText}`;

  // Anti-spam: collapse repeat Yukti-style (chat-session-less) escalations
  // from the same patient within the last hour into a single row. Scoped
  // narrowly via `chatSessionId IS NULL` so a coexisting session-based
  // pending consultation can't accidentally suppress or be overwritten by
  // a Yukti escalation.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [recentYukti] = await db.select().from(doctorConsultationsTable)
    .where(and(
      eq(doctorConsultationsTable.userId, user.id),
      eq(doctorConsultationsTable.source, "user_request"),
      eq(doctorConsultationsTable.status, "pending"),
      isNull(doctorConsultationsTable.chatSessionId),
      gt(doctorConsultationsTable.createdAt, oneHourAgo),
    ))
    .orderBy(desc(doctorConsultationsTable.createdAt))
    .limit(1);

  if (recentYukti) {
    const [updated] = await db.update(doctorConsultationsTable)
      .set({ reason, riskLevel: riskLevel ?? recentYukti.riskLevel })
      .where(eq(doctorConsultationsTable.id, recentYukti.id))
      .returning();
    res.json({ success: true, consultation: updated, merged: true });
    return;
  }

  const [consultation] = await db.insert(doctorConsultationsTable).values({
    userId: user.id,
    chatSessionId: null,
    riskLevel: riskLevel ?? "high",
    reason,
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
