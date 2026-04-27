import { Router } from "express";
import crypto from "node:crypto";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  paymentsTable,
  communitiesTable,
  communityMembersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

router.get("/payments/razorpay/config", requireAuth, async (_req, res) => {
  res.json({
    enabled: isRazorpayConfigured(),
    keyId: process.env.RAZORPAY_KEY_ID ?? null,
  });
});

router.post("/payments/razorpay/order", requireAuth, async (req, res) => {
  if (!isRazorpayConfigured()) {
    res.status(503).json({ error: "Payments are not configured. Please contact support." });
    return;
  }

  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { communityId, purpose } = req.body as { communityId?: number; purpose?: string };
  if (!communityId || !purpose) {
    res.status(400).json({ error: "communityId and purpose are required" });
    return;
  }

  const [community] = await db
    .select()
    .from(communitiesTable)
    .where(eq(communitiesTable.id, communityId));
  if (!community) { res.status(404).json({ error: "Community not found" }); return; }
  if (!community.isPremium || community.premiumPriceInr <= 0) {
    res.status(400).json({ error: "This community is not a premium community" });
    return;
  }

  // Check for existing paid access
  const [existing] = await db
    .select()
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.userId, user.id), eq(communityMembersTable.communityId, communityId)));
  if (existing?.hasPremiumAccess) {
    res.status(409).json({ error: "You already have premium access to this community", alreadyPaid: true });
    return;
  }

  const amountPaise = community.premiumPriceInr * 100;

  // Create order with Razorpay
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

  const orderResp = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `hc_${user.id}_${communityId}_${Date.now()}`,
      notes: { userId: user.id, communityId, purpose },
    }),
  });

  if (!orderResp.ok) {
    const errBody = await orderResp.text();
    logger.error({ status: orderResp.status, body: errBody }, "Razorpay order creation failed");
    res.status(502).json({ error: "Could not create payment order. Please try again." });
    return;
  }

  const order = (await orderResp.json()) as { id: string; amount: number; currency: string };

  await db.insert(paymentsTable).values({
    userId: user.id,
    communityId,
    provider: "razorpay",
    purpose,
    amountInr: community.premiumPriceInr,
    currency: "INR",
    status: "created",
    providerOrderId: order.id,
    notes: { receipt: `hc_${user.id}_${communityId}_${Date.now()}` },
  });

  res.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    communityName: community.name,
    amountInr: community.premiumPriceInr,
  });
});

router.post("/payments/razorpay/verify", requireAuth, async (req, res) => {
  if (!isRazorpayConfigured()) {
    res.status(503).json({ error: "Payments are not configured." });
    return;
  }

  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string;
  };
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing payment confirmation fields" });
    return;
  }

  const expectedSig = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET as string)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    await db
      .update(paymentsTable)
      .set({ status: "failed", providerPaymentId: razorpay_payment_id, providerSignature: razorpay_signature })
      .where(eq(paymentsTable.providerOrderId, razorpay_order_id));
    res.status(400).json({ error: "Payment verification failed. Signature mismatch." });
    return;
  }

  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.providerOrderId, razorpay_order_id));
  if (!payment || payment.userId !== user.id) {
    res.status(404).json({ error: "Payment record not found" });
    return;
  }

  await db
    .update(paymentsTable)
    .set({ status: "paid", providerPaymentId: razorpay_payment_id, providerSignature: razorpay_signature })
    .where(eq(paymentsTable.id, payment.id));

  if (payment.communityId) {
    // Upsert community member with premium access
    const [existing] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.userId, user.id), eq(communityMembersTable.communityId, payment.communityId)));
    if (existing) {
      await db
        .update(communityMembersTable)
        .set({ hasPremiumAccess: true, premiumPaymentId: razorpay_payment_id })
        .where(eq(communityMembersTable.id, existing.id));
    } else {
      await db
        .insert(communityMembersTable)
        .values({
          userId: user.id,
          communityId: payment.communityId,
          hasPremiumAccess: true,
          premiumPaymentId: razorpay_payment_id,
        })
        .onConflictDoNothing();
    }
  }

  res.json({ success: true, paymentId: payment.id });
});

export default router;
