import { Router } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getOrCreateUser, getAuth } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Register a PWA push subscription for the current user.
 */
router.post("/notifications/subscribe", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ error: "Invalid subscription payload" });
    return;
  }

  try {
    // Upsert logic: if endpoint exists, just update the user mapping/keys.
    const [existing] = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, endpoint))
      .limit(1);

    if (existing) {
      await db
        .update(pushSubscriptionsTable)
        .set({ userId: user.id, p256dh: keys.p256dh, auth: keys.auth })
        .where(eq(pushSubscriptionsTable.id, existing.id));
    } else {
      await db.insert(pushSubscriptionsTable).values({
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Push subscription failed");
    res.status(500).json({ error: "Failed to store subscription" });
  }
});

/**
 * Get the public VAPID key so the frontend can generate a subscription.
 */
router.get("/notifications/config", (_req, res) => {
  res.json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
  });
});

export default router;
