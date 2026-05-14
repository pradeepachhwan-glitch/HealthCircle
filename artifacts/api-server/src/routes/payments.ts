import { Router } from "express";
import { getAuth } from "../lib/auth";
import { db } from "@workspace/db";
import {
  paymentsTable,
  communitiesTable,
  communityMembersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { activateSubscription, SUBSCRIPTION_PRICE_INR, SUBSCRIPTION_DAYS } from "../lib/quota";
import Razorpay from "razorpay";
import crypto from "node:crypto";

const razorpay = process.env.RAZORPAY_KEY_ID ? new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
}) : null;

const router = Router();

const UPI_VPA = "9278347143@upi";
const UPI_PAYEE_NAME = "HealthCircle";

function buildUpiLink(amountInr: number, note: string, txnRef: string): string {
  const params = new URLSearchParams({
    pa: UPI_VPA,
    pn: UPI_PAYEE_NAME,
    am: String(amountInr.toFixed(2)),
    cu: "INR",
    tn: note,
    tr: txnRef,
  });
  return `upi://pay?${params.toString()}`;
}

// Razorpay endpoints
router.post("/payments/razorpay/create-order", requireAuth, async (req, res) => {
  if (!razorpay) {
    res.status(501).json({ error: "Razorpay is not configured on this server." });
    return;
  }
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { communityId, purpose } = req.body as { communityId?: number; purpose?: string };
  
  let amountInr = 0;
  let finalPurpose = purpose || "";

  if (communityId) {
    const [community] = await db
      .select()
      .from(communitiesTable)
      .where(eq(communitiesTable.id, communityId));
    if (!community) { res.status(404).json({ error: "Community not found" }); return; }
    if (!community.isPremium || community.premiumPriceInr <= 0) {
      res.status(400).json({ error: "This community is not a premium community" });
      return;
    }
    amountInr = community.premiumPriceInr;
    finalPurpose = finalPurpose || `community_premium_${communityId}`;
  } else if (purpose === "subscription_3mo") {
    amountInr = SUBSCRIPTION_PRICE_INR;
  } else {
    res.status(400).json({ error: "Valid communityId or purpose is required" });
    return;
  }

  if (amountInr < 1) {
    res.status(400).json({ error: "Minimum amount is 1 INR" });
    return;
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountInr * 100, // paise
      currency: "INR",
      receipt: `HC_${user.id}_${Date.now()}`,
    });

    const [payment] = await db
      .insert(paymentsTable)
      .values({
        userId: user.id,
        communityId: communityId || null,
        provider: "razorpay",
        purpose: finalPurpose,
        amountInr,
        currency: "INR",
        status: "created",
        providerOrderId: order.id,
        notes: { razorpayOrderId: order.id },
      })
      .returning();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error);
    res.status(500).json({ error: "Failed to create payment order" });
  }
});

router.post("/payments/razorpay/verify", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Missing required Razorpay fields" });
    return;
  }

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(sign.toString())
    .digest("hex");

  if (expectedSign !== razorpay_signature) {
    res.status(400).json({ error: "Invalid payment signature" });
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

  if (payment.status === "paid") {
    res.json({ success: true, alreadyPaid: true });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(paymentsTable)
      .set({
        status: "paid",
        providerPaymentId: razorpay_payment_id,
        providerSignature: razorpay_signature,
        updatedAt: new Date(),
      })
      .where(eq(paymentsTable.id, payment.id));

    if (payment.communityId) {
      const [existing] = await tx
        .select()
        .from(communityMembersTable)
        .where(and(eq(communityMembersTable.userId, user.id), eq(communityMembersTable.communityId, payment.communityId)));
      
      if (existing) {
        await tx
          .update(communityMembersTable)
          .set({ hasPremiumAccess: true, premiumPaymentId: razorpay_payment_id })
          .where(eq(communityMembersTable.id, existing.id));
      } else {
        await tx
          .insert(communityMembersTable)
          .values({
            userId: user.id,
            communityId: payment.communityId,
            hasPremiumAccess: true,
            premiumPaymentId: razorpay_payment_id,
          });
      }
    }

    if (payment.purpose === "subscription_3mo") {
      await activateSubscription(user.id);
    }
  });

  res.json({ success: true });
});

router.get("/payments/upi/config", requireAuth, (_req, res) => {
  res.json({ enabled: true, provider: "upi", upiId: UPI_VPA, payeeName: UPI_PAYEE_NAME });
});

router.post("/payments/upi/initiate", requireAuth, async (req, res) => {
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

  const [existingMembership] = await db
    .select()
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.userId, user.id), eq(communityMembersTable.communityId, communityId)));
  if (existingMembership?.hasPremiumAccess) {
    res.status(409).json({ error: "You already have premium access to this community", alreadyPaid: true });
    return;
  }

  const txnRef = `HC${user.id}C${communityId}T${Date.now()}`;
  const note = `${community.name} Premium`.slice(0, 80);

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      userId: user.id,
      communityId,
      provider: "upi",
      purpose,
      amountInr: community.premiumPriceInr,
      currency: "INR",
      status: "created",
      providerOrderId: txnRef,
      notes: { upiId: UPI_VPA, communityName: community.name },
    })
    .returning();

  res.json({
    paymentId: payment.id,
    upiId: UPI_VPA,
    payeeName: UPI_PAYEE_NAME,
    amountInr: community.premiumPriceInr,
    txnRef,
    note,
    upiLink: buildUpiLink(community.premiumPriceInr, note, txnRef),
    communityName: community.name,
  });
});

router.post("/payments/upi/confirm", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { paymentId, utr } = req.body as { paymentId?: number; utr?: string };
  if (!paymentId || !utr || utr.trim().length < 6) {
    res.status(400).json({ error: "paymentId and a valid UTR / transaction reference are required" });
    return;
  }

  const cleanUtr = utr.trim().replace(/\s+/g, "").toUpperCase();
  if (cleanUtr.length > 32 || !/^[A-Z0-9]+$/.test(cleanUtr)) {
    res.status(400).json({ error: "UTR must be 6-32 alphanumeric characters" });
    return;
  }

  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.id, paymentId));
  if (!payment || payment.userId !== user.id) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  if (payment.status === "paid") {
    res.json({ success: true, paymentId: payment.id, alreadyConfirmed: true });
    return;
  }

  // Idempotent state transition: only the request that flips status from
  // "created" → "paid" proceeds to grant entitlements. Concurrent confirms
  // for the same paymentId will see updated.length === 0 and short-circuit.
  const updated = await db
    .update(paymentsTable)
    .set({
      status: "paid",
      providerPaymentId: cleanUtr,
      notes: { ...(payment.notes as Record<string, unknown> | null ?? {}), utr: cleanUtr, confirmedAt: new Date().toISOString() },
    })
    .where(and(eq(paymentsTable.id, payment.id), eq(paymentsTable.status, "created")))
    .returning({ id: paymentsTable.id });

  if (updated.length === 0) {
    res.json({ success: true, paymentId: payment.id, alreadyConfirmed: true });
    return;
  }

  if (payment.communityId) {
    const [existing] = await db
      .select()
      .from(communityMembersTable)
      .where(and(eq(communityMembersTable.userId, user.id), eq(communityMembersTable.communityId, payment.communityId)));
    if (existing) {
      await db
        .update(communityMembersTable)
        .set({ hasPremiumAccess: true, premiumPaymentId: cleanUtr })
        .where(eq(communityMembersTable.id, existing.id));
    } else {
      await db
        .insert(communityMembersTable)
        .values({
          userId: user.id,
          communityId: payment.communityId,
          hasPremiumAccess: true,
          premiumPaymentId: cleanUtr,
        })
        .onConflictDoNothing();
    }
  }

  if (payment.purpose === "subscription_3mo") {
    const expiresAt = await activateSubscription(user.id);
    res.json({
      success: true,
      paymentId: payment.id,
      utr: cleanUtr,
      subscription: { expiresAt: expiresAt.toISOString() },
    });
    return;
  }

  res.json({ success: true, paymentId: payment.id, utr: cleanUtr });
});

router.post("/payments/upi/subscribe", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const txnRef = `HC${user.id}SUB${Date.now()}`;
  const note = `HealthCircle 3-Month Plan`.slice(0, 80);

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      userId: user.id,
      provider: "upi",
      purpose: "subscription_3mo",
      amountInr: SUBSCRIPTION_PRICE_INR,
      currency: "INR",
      status: "created",
      providerOrderId: txnRef,
      notes: { upiId: UPI_VPA, planDays: SUBSCRIPTION_DAYS },
    })
    .returning();

  res.json({
    paymentId: payment.id,
    upiId: UPI_VPA,
    payeeName: UPI_PAYEE_NAME,
    amountInr: SUBSCRIPTION_PRICE_INR,
    planDays: SUBSCRIPTION_DAYS,
    txnRef,
    note,
    upiLink: buildUpiLink(SUBSCRIPTION_PRICE_INR, note, txnRef),
  });
});

export default router;
