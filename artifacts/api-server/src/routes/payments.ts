import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  paymentsTable,
  communitiesTable,
  communityMembersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { activateSubscription, SUBSCRIPTION_PRICE_INR, SUBSCRIPTION_DAYS } from "../lib/quota";

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
