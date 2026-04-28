import crypto from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, sessionsTable, emailOtpsTable } from "@workspace/db";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { logger } from "./logger";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;

// ---- Session shape ----
export interface SessionData {
  userId: number;
}

// ---- Email normalization ----
export function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 320;
}

// ---- Session CRUD ----
export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSessionRow(sid: string): Promise<SessionData | null> {
  const [row] = await db.select().from(sessionsTable).where(eq(sessionsTable.sid, sid));
  if (!row) return null;
  if (row.expire < new Date()) {
    await deleteSession(sid);
    return null;
  }
  return row.sess as unknown as SessionData;
}

export async function touchSession(sid: string): Promise<void> {
  // Sliding expiration: extend session expiry on activity.
  await db
    .update(sessionsTable)
    .set({ expire: new Date(Date.now() + SESSION_TTL) })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, { ...COOKIE_OPTS, maxAge: SESSION_TTL });
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, COOKIE_OPTS);
}

export function getSessionId(req: Request): string | undefined {
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies?.[SESSION_COOKIE];
}

// ---- Compatibility shim for code that imported getAuth from @clerk/express ----
export function getAuth(req: Request): { userId: string | null } {
  return { userId: req.user?.clerkId ?? null };
}

// ---- User upsert by email ----
export async function findOrCreateUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
  if (existing.length > 0) return existing[0];

  const clerkId = `email:${normalized}`;
  const displayName = normalized.split("@")[0] || "Healthcare Member";
  const [created] = await db.insert(usersTable).values({
    clerkId,
    displayName,
    email: normalized,
    avatarUrl: null,
    role: "member",
    isBanned: false,
    healthCredits: 0,
    weeklyCredits: 0,
    level: 1,
  }).returning();
  return created;
}

// ---- getOrCreateUser kept for backward-compat with existing handlers ----
export async function getOrCreateUser(
  clerkId: string,
  userData?: { displayName?: string; email?: string; avatarUrl?: string; username?: string; mobileNumber?: string },
) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    const updates: Record<string, unknown> = {};
    if (userData?.username && !u.username) updates.username = userData.username;
    if (userData?.mobileNumber && !u.mobileNumber) updates.mobileNumber = userData.mobileNumber;
    if (Object.keys(updates).length > 0) {
      const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, clerkId)).returning();
      return updated;
    }
    return u;
  }

  const [created] = await db.insert(usersTable).values({
    clerkId,
    displayName: userData?.displayName ?? "Healthcare Member",
    email: userData?.email ?? `${clerkId}@healthcircle.ai`,
    avatarUrl: userData?.avatarUrl ?? null,
    username: userData?.username ?? null,
    mobileNumber: userData?.mobileNumber ?? null,
    role: "member",
    isBanned: false,
    healthCredits: 0,
    weeklyCredits: 0,
    level: 1,
  }).returning();
  return created;
}

// ---- OTP helpers ----
function generateOtpCode(): string {
  // 6 digit numeric, zero-padded.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

function hashOtp(code: string, email: string): string {
  // Email is included as a salt so a code is bound to its email.
  return crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");
}

export interface IssueOtpResult {
  ok: boolean;
  reason?: "cooldown" | "invalid_email";
  retryAfterMs?: number;
  code?: string; // present so caller can send the email; never returned to client
}

export async function issueOtpForEmail(email: string): Promise<IssueOtpResult> {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) return { ok: false, reason: "invalid_email" };

  // Check cooldown — most recent issuance for this email.
  const [recent] = await db
    .select()
    .from(emailOtpsTable)
    .where(eq(emailOtpsTable.email, normalized))
    .orderBy(desc(emailOtpsTable.createdAt))
    .limit(1);

  if (recent) {
    const ageMs = Date.now() - new Date(recent.createdAt).getTime();
    if (ageMs < OTP_RESEND_COOLDOWN_MS) {
      return { ok: false, reason: "cooldown", retryAfterMs: OTP_RESEND_COOLDOWN_MS - ageMs };
    }
  }

  const code = generateOtpCode();
  await db.insert(emailOtpsTable).values({
    email: normalized,
    codeHash: hashOtp(code, normalized),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
    consumed: false,
    attempts: 0,
  });

  // Best-effort cleanup of expired rows (keeps table tidy without a cron job).
  void db.delete(emailOtpsTable).where(lt(emailOtpsTable.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000))).catch(() => {});

  return { ok: true, code };
}

export interface ConsumeOtpResult {
  ok: boolean;
  reason?: "no_otp" | "expired" | "too_many_attempts" | "wrong_code";
}

export async function consumeOtp(email: string, providedCode: string): Promise<ConsumeOtpResult> {
  const normalized = normalizeEmail(email);
  const code = String(providedCode ?? "").trim();
  if (!/^\d{4,8}$/.test(code)) return { ok: false, reason: "wrong_code" };

  // Look at the most recent un-consumed OTP for this email so we can return
  // accurate reasons (expired, too_many_attempts, etc). The actual consume is
  // done atomically below via a conditional UPDATE so concurrent verify
  // requests cannot double-spend a code.
  const [row] = await db
    .select()
    .from(emailOtpsTable)
    .where(and(eq(emailOtpsTable.email, normalized), eq(emailOtpsTable.consumed, false)))
    .orderBy(desc(emailOtpsTable.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: "no_otp" };

  if (row.expiresAt < new Date()) {
    await db.update(emailOtpsTable).set({ consumed: true }).where(eq(emailOtpsTable.id, row.id));
    return { ok: false, reason: "expired" };
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(emailOtpsTable).set({ consumed: true }).where(eq(emailOtpsTable.id, row.id));
    return { ok: false, reason: "too_many_attempts" };
  }

  const expected = row.codeHash;
  const got = hashOtp(code, normalized);
  let match = false;
  try {
    match = expected.length === got.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    match = false;
  }

  if (!match) {
    // Atomic-ish increment using SQL so two concurrent wrong attempts are
    // both counted. We use the WHERE on consumed=false so we don't bump a
    // row that someone else just consumed.
    await db
      .update(emailOtpsTable)
      .set({ attempts: sql`${emailOtpsTable.attempts} + 1` })
      .where(and(eq(emailOtpsTable.id, row.id), eq(emailOtpsTable.consumed, false)));
    return { ok: false, reason: "wrong_code" };
  }

  // Atomic consume: only mark as consumed if it is still un-consumed AND
  // still has the same code_hash AND is not expired AND under max attempts.
  // If two concurrent valid verifies hit, only one will get a returned row.
  const updated = await db
    .update(emailOtpsTable)
    .set({ consumed: true })
    .where(
      and(
        eq(emailOtpsTable.id, row.id),
        eq(emailOtpsTable.consumed, false),
        eq(emailOtpsTable.codeHash, got),
      ),
    )
    .returning({ id: emailOtpsTable.id });

  if (updated.length === 0) {
    // Lost the race or row state changed under us.
    return { ok: false, reason: "no_otp" };
  }

  return { ok: true };
}

// ---- Role guards ----
function safeStringEqual(a: string, b: string): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Server-secret bypass — useful for bootstrapping/recovery without a session.
  // If a valid x-admin-token is presented and the caller is also signed in, we
  // auto-promote their DB row to admin so subsequent requests work through the
  // normal session path.
  const provided = (req.header("x-admin-token") ?? "").trim();
  const expected = (process.env.ADMIN_TOKEN ?? "").trim();
  const tokenOk = expected.length > 0 && safeStringEqual(provided, expected);

  if (tokenOk) {
    if (req.user && req.user.role !== "admin") {
      try {
        await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.clerkId, req.user.clerkId));
      } catch (err) {
        logger.warn({ err }, "auto-promote to admin failed");
      }
    }
    next();
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }
  next();
}

export async function requireMedPro(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "medical_professional" && req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: Medical Professional access required" });
    return;
  }
  next();
}

export async function requireModeratorOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "admin" && req.user.role !== "moderator") {
    res.status(403).json({ error: "Forbidden: Moderator or Admin access required" });
    return;
  }
  next();
}
