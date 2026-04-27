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

export async function getOrCreateUser(clerkId: string, userData?: { displayName?: string; email?: string; avatarUrl?: string }) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (existing.length > 0) return existing[0];

  const [created] = await db.insert(usersTable).values({
    clerkId,
    displayName: userData?.displayName ?? "Healthcare Professional",
    email: userData?.email ?? `${clerkId}@askhealth.ai`,
    avatarUrl: userData?.avatarUrl ?? null,
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
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length || users[0].role !== "admin") {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }
  next();
}

export async function requireModeratorOrAdmin(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!users.length || (users[0].role !== "admin" && users[0].role !== "moderator")) {
    res.status(403).json({ error: "Forbidden: Moderator or Admin access required" });
    return;
  }
  next();
}
