import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

// Setup VAPID keys from environment
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  webpush.setVapidDetails(
    "mailto:contact@healthcircle.app",
    publicVapidKey,
    privateVapidKey
  );
} else {
  logger.warn("VAPID keys not set. Push notifications will be disabled.");
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Send a push notification to all devices registered for a specific user.
 */
export async function sendPushToUser(userId: number, payload: PushPayload) {
  if (!publicVapidKey || !privateVapidKey) return;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));

  if (subs.length === 0) return;

  const notificationPayload = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, notificationPayload);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // Subscription has expired or is no longer valid, delete it.
          await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, sub.id));
        } else {
          throw err;
        }
      }
    })
  );

  const successful = results.filter((r) => r.status === "fulfilled").length;
  logger.info({ userId, successful, total: subs.length }, "Push notifications sent");
}
