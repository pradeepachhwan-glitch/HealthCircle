import { Router } from "express";
import { getAuthUrl, handleAuthCallback } from "../lib/googleCalendar";
import { logger } from "../lib/logger";
import { requirePartnerAccess } from "../lib/auth";
import { db, googleTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * These endpoints are mounted under /api/auth via routes/index.ts
 * Resulting paths:
 * /api/auth/google/auth-url
 * /api/auth/google/connection-status
 * /api/auth/callback/google (Legacy compatible)
 */

router.get("/google/auth-url", requirePartnerAccess, async (req: any, res) => {
  const url = await getAuthUrl(req.user.id);
  res.json({ url });
});

router.get("/google/connection-status", requirePartnerAccess, async (req: any, res) => {
  const [tokenRow] = await db
    .select({ googleEmail: googleTokensTable.googleEmail })
    .from(googleTokensTable)
    .where(eq(googleTokensTable.userId, req.user.id))
    .limit(1);
  
  res.json({
    connected: !!tokenRow,
    email: tokenRow?.googleEmail ?? null,
  });
});

// Legacy production callback path
router.get("/callback/google", async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    res.status(400).send("Missing code or state");
    return;
  }

  try {
    const { userId } = JSON.parse(state as string);
    await handleAuthCallback(userId, code as string);
    
    // Redirect back to the app (doctor dashboard or profile)
    res.redirect("/profile?google=connected");
  } catch (err) {
    logger.error({ err }, "Google Auth Callback failed");
    res.status(500).send("Authentication failed. Please try again.");
  }
});

export default router;
