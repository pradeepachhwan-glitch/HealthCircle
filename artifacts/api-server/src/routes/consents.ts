import { Router } from "express";
import { db } from "@workspace/db";
import { consentsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router = Router();

router.post("/consents", requireAuth, async (req, res) => {
  const user = await getOrCreateUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { consentTypes } = req.body as { consentTypes: ("post_health_data" | "ai_assistance")[] };
  if (!Array.isArray(consentTypes) || consentTypes.length === 0) {
    res.status(400).json({ error: "consentTypes array is required" }); return;
  }

  for (const consentType of consentTypes) {
    await db.insert(consentsTable)
      .values({ userId: user.id, consentType, accepted: true })
      .onConflictDoNothing();
  }

  res.json({ success: true });
});

router.get("/consents/check", requireAuth, async (req, res) => {
  const user = await getOrCreateUser(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const consents = await db.select()
    .from(consentsTable)
    .where(and(eq(consentsTable.userId, user.id), eq(consentsTable.accepted, true)));

  const types = consents.map(c => c.consentType);
  res.json({
    hasPostConsent: types.includes("post_health_data"),
    hasAiConsent: types.includes("ai_assistance"),
    all: types,
  });
});

export default router;
