import { db } from "@workspace/db";
import { apiUsageTable, usersTable } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "./logger";

export const QUOTA_LIMITS = {
  daily: 4,
  weekly: 15,
  monthly: 50,
} as const;

export const SUBSCRIPTION_PRICE_INR = 299;
export const SUBSCRIPTION_DAYS = 90;

function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return dayKey(d);
}

function startOfTomorrowUtc(): Date {
  const d = startOfTodayUtc();
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// For rolling N-day windows: the next time a usage day "falls out" is
// always at the next UTC midnight (the oldest in-window day expires
// then). After that, capacity may free up depending on usage distribution.
function nextRollingResetUtc(): Date {
  return startOfTomorrowUtc();
}

export interface QuotaStatus {
  allowed: boolean;
  hasSubscription: boolean;
  subscriptionExpiresAt: string | null;
  used: { daily: number; weekly: number; monthly: number };
  limits: { daily: number; weekly: number; monthly: number };
  exceeded: "daily" | "weekly" | "monthly" | null;
  resetAt: string | null;
}

async function hasActiveSubscription(userId: number): Promise<{ active: boolean; expiresAt: Date | null }> {
  const [u] = await db.select({ exp: usersTable.subscriptionExpiresAt }).from(usersTable).where(eq(usersTable.id, userId));
  if (!u || !u.exp) return { active: false, expiresAt: null };
  const expDate = new Date(u.exp);
  return { active: expDate.getTime() > Date.now(), expiresAt: expDate };
}

async function getCounts(userId: number): Promise<{ daily: number; weekly: number; monthly: number }> {
  const today = dayKey();
  const sevenDaysAgo = daysAgoKey(6);
  const thirtyDaysAgo = daysAgoKey(29);

  const rows = await db
    .select({ dayKey: apiUsageTable.dayKey, count: apiUsageTable.count })
    .from(apiUsageTable)
    .where(and(eq(apiUsageTable.userId, userId), gte(apiUsageTable.dayKey, thirtyDaysAgo)));

  let daily = 0, weekly = 0, monthly = 0;
  for (const r of rows) {
    monthly += r.count;
    if (r.dayKey >= sevenDaysAgo) weekly += r.count;
    if (r.dayKey === today) daily += r.count;
  }
  return { daily, weekly, monthly };
}

export async function checkQuota(userId: number): Promise<QuotaStatus> {
  const sub = await hasActiveSubscription(userId);
  const used = await getCounts(userId);
  if (sub.active) {
    return {
      allowed: true,
      hasSubscription: true,
      subscriptionExpiresAt: sub.expiresAt?.toISOString() ?? null,
      used,
      limits: QUOTA_LIMITS,
      exceeded: null,
      resetAt: null,
    };
  }
  let exceeded: "daily" | "weekly" | "monthly" | null = null;
  let resetAt: Date | null = null;
  // For all three windows the next reset opportunity is the next UTC
  // midnight (when today's day-key starts being "yesterday" and the
  // oldest in-window day rolls out). Capacity may free up partially
  // depending on the user's usage distribution.
  if (used.monthly >= QUOTA_LIMITS.monthly) { exceeded = "monthly"; resetAt = nextRollingResetUtc(); }
  else if (used.weekly >= QUOTA_LIMITS.weekly) { exceeded = "weekly"; resetAt = nextRollingResetUtc(); }
  else if (used.daily >= QUOTA_LIMITS.daily) { exceeded = "daily"; resetAt = nextRollingResetUtc(); }

  return {
    allowed: exceeded === null,
    hasSubscription: false,
    subscriptionExpiresAt: null,
    used,
    limits: QUOTA_LIMITS,
    exceeded,
    resetAt: resetAt?.toISOString() ?? null,
  };
}

export async function consumeQuota(userId: number): Promise<void> {
  const today = dayKey();
  try {
    await db
      .insert(apiUsageTable)
      .values({ userId, dayKey: today, count: 1 })
      .onConflictDoUpdate({
        target: [apiUsageTable.userId, apiUsageTable.dayKey],
        set: { count: sql`${apiUsageTable.count} + 1`, updatedAt: new Date() },
      });
  } catch (err) {
    logger.warn({ err, userId }, "Failed to consume quota — continuing");
  }
}

export async function activateSubscription(userId: number, days: number = SUBSCRIPTION_DAYS): Promise<Date> {
  const [u] = await db.select({ exp: usersTable.subscriptionExpiresAt }).from(usersTable).where(eq(usersTable.id, userId));
  const now = Date.now();
  const base = u?.exp && new Date(u.exp).getTime() > now ? new Date(u.exp).getTime() : now;
  const newExp = new Date(base + days * 24 * 60 * 60 * 1000);
  await db.update(usersTable).set({ subscriptionExpiresAt: newExp }).where(eq(usersTable.id, userId));
  return newExp;
}
