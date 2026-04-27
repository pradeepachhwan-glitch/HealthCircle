import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, communitiesTable, communityMembersTable, usersTable, postsTable, commentsTable } from "@workspace/db";
import { eq, and, gte, count, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/communities", requireAuth, async (req, res) => {
  const { includeArchived } = req.query as { includeArchived?: string };
  const showArchived = includeArchived === "true";

  const communities = await db.select().from(communitiesTable)
    .where(showArchived ? undefined : eq(communitiesTable.isArchived, false))
    .orderBy(desc(communitiesTable.createdAt));

  const result = await Promise.all(communities.map(async (c) => {
    const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));
    return { ...c, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0) };
  }));

  res.json(result);
});

router.post("/communities", requireAdmin, async (req, res) => {
  const { name, slug, description, iconEmoji, coverColor } = req.body;
  const [community] = await db.insert(communitiesTable).values({
    name, slug, description: description ?? null, iconEmoji: iconEmoji ?? null, coverColor: coverColor ?? null,
  }).returning();
  res.status(201).json({ ...community, memberCount: 0, postCount: 0 });
});

router.get("/communities/:communityId", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
  if (!community) { res.status(404).json({ error: "Not found" }); return; }
  const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, communityId));
  const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, communityId));
  res.json({ ...community, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0) });
});

router.patch("/communities/:communityId", requireAdmin, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const { name, description, iconEmoji, coverColor, isArchived } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (iconEmoji !== undefined) updates.iconEmoji = iconEmoji;
  if (coverColor !== undefined) updates.coverColor = coverColor;
  if (isArchived !== undefined) updates.isArchived = isArchived;

  const [updated] = await db.update(communitiesTable).set(updates).where(eq(communitiesTable.id, communityId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, communityId));
  const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, communityId));
  res.json({ ...updated, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0) });
});

router.delete("/communities/:communityId", requireAdmin, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  await db.update(communitiesTable).set({ isArchived: true }).where(eq(communitiesTable.id, communityId));
  res.json({ success: true });
});

router.get("/communities/:communityId/stats", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, communityId));
  const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, communityId));
  const [commentRes] = await db
    .select({ count: count() })
    .from(commentsTable)
    .innerJoin(postsTable, eq(commentsTable.postId, postsTable.id))
    .where(eq(postsTable.communityId, communityId));
  const [weeklyPostRes] = await db.select({ count: count() }).from(postsTable)
    .where(and(eq(postsTable.communityId, communityId), gte(postsTable.createdAt, oneWeekAgo)));
  const [weeklyCommentRes] = await db
    .select({ count: count() })
    .from(commentsTable)
    .innerJoin(postsTable, eq(commentsTable.postId, postsTable.id))
    .where(and(eq(postsTable.communityId, communityId), gte(commentsTable.createdAt, oneWeekAgo)));
  const [weeklyMemberRes] = await db.select({ count: count() }).from(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, communityId), gte(communityMembersTable.joinedAt, oneWeekAgo)));

  res.json({
    communityId,
    memberCount: Number(memberRes?.count ?? 0),
    postCount: Number(postRes?.count ?? 0),
    commentCount: Number(commentRes?.count ?? 0),
    weeklyPosts: Number(weeklyPostRes?.count ?? 0),
    weeklyComments: Number(weeklyCommentRes?.count ?? 0),
    weeklyNewMembers: Number(weeklyMemberRes?.count ?? 0),
  });
});

router.get("/communities/:communityId/members", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const members = await db
    .select({ user: usersTable })
    .from(communityMembersTable)
    .innerJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
    .where(eq(communityMembersTable.communityId, communityId))
    .orderBy(desc(usersTable.healthCredits));

  res.json(members.map(m => ({
    id: m.user.clerkId, clerkId: m.user.clerkId, displayName: m.user.displayName,
    email: m.user.email, avatarUrl: m.user.avatarUrl, role: m.user.role,
    isBanned: m.user.isBanned, healthCredits: m.user.healthCredits,
    level: m.user.level, weeklyCredits: m.user.weeklyCredits, createdAt: m.user.createdAt,
  })));
});

export default router;
