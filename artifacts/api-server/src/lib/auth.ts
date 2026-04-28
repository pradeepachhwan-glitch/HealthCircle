import * as oidc from "openid-client";
import crypto from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ---- OIDC config ----
export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

let oidcConfig: oidc.Configuration | null = null;

export async function getOidcConfig(): Promise<oidc.Configuration> {
  if (!oidcConfig) {
    if (!process.env.REPL_ID) throw new Error("REPL_ID env var is not set");
    oidcConfig = await oidc.discovery(new URL(ISSUER_URL), process.env.REPL_ID);
  }
  return oidcConfig;
}

// ---- Session shape ----
export interface SessionData {
  sub: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
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

export async function updateSession(sid: string, data: SessionData): Promise<void> {
  await db.update(sessionsTable)
    .set({ sess: data as unknown as Record<string, unknown>, expire: new Date(Date.now() + SESSION_TTL) })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
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

// ---- User upsert from OIDC claims ----
export async function upsertReplitUser(claims: Record<string, unknown>) {
  const sub = String(claims.sub);
  const claimEmail = (claims.email as string | undefined)?.trim();
  const email = claimEmail && claimEmail.length > 0 ? claimEmail : `${sub}@healthcircle.ai`;
  const firstName = (claims.first_name as string | undefined) ?? "";
  const lastName = (claims.last_name as string | undefined) ?? "";
  const usernameClaim = (claims.username as string | undefined) ?? "";
  const displayName =
    `${firstName} ${lastName}`.trim() ||
    usernameClaim ||
    email.split("@")[0] ||
    "Healthcare Member";
  const avatarUrl = ((claims.profile_image_url as string | undefined) ??
    (claims.picture as string | undefined) ??
    null) as string | null;

  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, sub)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    const updates: Record<string, unknown> = {};
    if (claimEmail && u.email !== claimEmail && !claimEmail.endsWith("@healthcircle.ai")) {
      updates.email = claimEmail;
    }
    if (avatarUrl && !u.avatarUrl) updates.avatarUrl = avatarUrl;
    if (displayName && (u.displayName === "Healthcare Member" || !u.displayName)) {
      updates.displayName = displayName;
    }
    if (Object.keys(updates).length > 0) {
      const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, sub)).returning();
      return updated;
    }
    return u;
  }

  const [created] = await db.insert(usersTable).values({
    clerkId: sub,
    displayName,
    email,
    avatarUrl,
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

// ---- Role guards (operate on req.user populated by authMiddleware) ----
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
  // Server-secret bypass — useful for bootstrapping/recovery without logging
  // in. If a valid x-admin-token is presented and the caller is also signed
  // in, we auto-promote their DB row to admin so subsequent requests work
  // through the normal session path.
  const provided = (req.header("x-admin-token") ?? "").trim();
  const expected = (process.env.ADMIN_TOKEN ?? "").trim();
  const tokenOk = expected.length > 0 && safeStringEqual(provided, expected);

  if (tokenOk) {
    if (req.user && req.user.role !== "admin") {
      try {
        await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.clerkId, req.user.clerkId));
      } catch {
        /* non-fatal */
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
