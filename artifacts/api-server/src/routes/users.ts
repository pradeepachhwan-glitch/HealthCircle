import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, postsTable, commentsTable, communityMembersTable, communitiesTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
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

router.get("/users/me/posts", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const posts = await db
    .select({ post: postsTable, community: communitiesTable })
    .from(postsTable)
    .innerJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
    .where(eq(postsTable.authorId, user.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(20);

  res.json(posts.map(({ post, community }) => ({
    ...post, communityName: community.name, communitySlug: community.slug,
    communityIcon: community.iconEmoji, communityId: community.id,
  })));
});

router.get("/users/me/communities", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const memberships = await db
    .select({ community: communitiesTable, member: communityMembersTable })
    .from(communityMembersTable)
    .innerJoin(communitiesTable, eq(communityMembersTable.communityId, communitiesTable.id))
    .where(and(eq(communityMembersTable.userId, user.id), eq(communitiesTable.isArchived, false)))
    .orderBy(desc(communityMembersTable.joinedAt));

  const result = await Promise.all(memberships.map(async ({ community }) => {
    const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, community.id));
    const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, community.id));
    return { ...community, postCount: Number(postRes?.count ?? 0), memberCount: Number(memberRes?.count ?? 0), isMember: true };
  }));

  res.json(result);
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
