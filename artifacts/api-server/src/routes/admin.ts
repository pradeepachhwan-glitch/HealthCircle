import { Router } from "express";
import { db, usersTable, communitiesTable, postsTable, commentsTable, communityMembersTable } from "@workspace/db";
import { count, eq, gte, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";

const router = Router();

router.post("/admin/broadcast", requireAdmin, async (req, res) => {
  const { getAuth } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [admin] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!admin) { res.status(404).json({ error: "Admin user not found" }); return; }

  const { title, content, communityIds, postToAll } = req.body;

  let targetCommunityIds: number[] = [];
  if (postToAll) {
    const communities = await db.select({ id: communitiesTable.id }).from(communitiesTable).where(eq(communitiesTable.isArchived, false));
    targetCommunityIds = communities.map(c => c.id);
  } else if (communityIds && Array.isArray(communityIds)) {
    targetCommunityIds = communityIds;
  }

  const insertedPosts = await Promise.all(targetCommunityIds.map(communityId =>
    db.insert(postsTable).values({
      communityId, authorId: admin.id, title, content,
      isPinned: false, isBroadcast: true, upvoteCount: 0, commentCount: 0,
    }).returning()
  ));

  res.status(201).json({ postsCreated: insertedPosts.length, communityIds: targetCommunityIds });
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [communityCount] = await db.select({ count: count() }).from(communitiesTable).where(eq(communitiesTable.isArchived, false));
  const [postCount] = await db.select({ count: count() }).from(postsTable);
  const [commentCount] = await db.select({ count: count() }).from(commentsTable);
  const [weeklyUsers] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.updatedAt, oneWeekAgo));
  const [newUsersCount] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, oneWeekAgo));

  const communities = await db.select().from(communitiesTable).where(eq(communitiesTable.isArchived, false)).limit(5).orderBy(desc(communitiesTable.createdAt));
  const topCommunities = await Promise.all(communities.map(async (c) => {
    const [mc] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [pc] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));
    return { ...c, memberCount: Number(mc?.count ?? 0), postCount: Number(pc?.count ?? 0) };
  }));

  res.json({
    totalUsers: Number(userCount?.count ?? 0),
    totalCommunities: Number(communityCount?.count ?? 0),
    totalPosts: Number(postCount?.count ?? 0),
    totalComments: Number(commentCount?.count ?? 0),
    weeklyActiveUsers: Number(weeklyUsers?.count ?? 0),
    newUsersThisWeek: Number(newUsersCount?.count ?? 0),
    topCommunities,
  });
});

export default router;
