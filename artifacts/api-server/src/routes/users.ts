import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth, requireAdmin, getOrCreateUser } from "../lib/auth";

const router = Router();

function toProfile(u: typeof usersTable.$inferSelect) {
  return {
    id: u.clerkId, clerkId: u.clerkId, displayName: u.displayName,
    email: u.email, avatarUrl: u.avatarUrl, role: u.role,
    isBanned: u.isBanned, healthCredits: u.healthCredits,
    level: u.level, weeklyCredits: u.weeklyCredits, createdAt: u.createdAt,
  };
}

router.get("/users/me", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  res.json(toProfile(user));
});

router.patch("/users/me", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { displayName, avatarUrl } = req.body;
  const updates: Record<string, unknown> = {};
  if (displayName !== undefined) updates.displayName = displayName;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.clerkId, clerkId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toProfile(updated));
});

// Bootstrap: promotes calling user to admin if NO admin exists yet
router.post("/admin/bootstrap", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Check if any admin already exists
  const [adminCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "admin"));
  if (Number(adminCount?.count ?? 0) > 0) {
    res.status(403).json({ error: "An admin already exists. Contact them for access." });
    return;
  }

  // Promote this user to admin
  const user = await getOrCreateUser(clerkId);
  const [promoted] = await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.clerkId, clerkId)).returning();
  res.json({ success: true, message: "You are now the admin!", user: toProfile(promoted) });
});

router.get("/admin/bootstrap/status", requireAuth, async (req, res) => {
  const [adminCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "admin"));
  res.json({ adminExists: Number(adminCount?.count ?? 0) > 0 });
});

router.get("/users", requireAdmin, async (req, res) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(toProfile));
});

router.get("/users/:userId", requireAuth, async (req, res) => {
  const clerkId = req.params.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toProfile(user));
});

router.patch("/users/:userId/role", requireAdmin, async (req, res) => {
  const clerkId = req.params.userId;
  const { role } = req.body;
  const [updated] = await db.update(usersTable).set({ role }).where(eq(usersTable.clerkId, clerkId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toProfile(updated));
});

router.patch("/users/:userId/ban", requireAdmin, async (req, res) => {
  const clerkId = req.params.userId;
  const { isBanned } = req.body;
  const [updated] = await db.update(usersTable).set({ isBanned }).where(eq(usersTable.clerkId, clerkId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toProfile(updated));
});

export default router;
