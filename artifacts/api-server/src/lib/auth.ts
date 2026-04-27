import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export async function getOrCreateUser(clerkId: string, userData?: { displayName?: string; email?: string; avatarUrl?: string; username?: string; mobileNumber?: string }) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) {
    // Update username/mobile if provided and not yet set
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

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length || users[0].role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }
  next();
}

export async function requireMedPro(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length || (users[0].role !== "medical_professional" && users[0].role !== "admin")) {
    res.status(403).json({ error: "Forbidden: Medical Professional access required" });
    return;
  }
  next();
}

export async function requireModeratorOrAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length || (users[0].role !== "admin" && users[0].role !== "moderator")) {
    res.status(403).json({ error: "Forbidden: Moderator or Admin access required" });
    return;
  }
  next();
}
