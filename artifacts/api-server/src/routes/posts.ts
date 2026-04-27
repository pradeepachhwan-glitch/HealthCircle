import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, postsTable, usersTable, commentsTable, postUpvotesTable, communityMembersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireModeratorOrAdmin, getOrCreateUser } from "../lib/auth";
import { awardCredits, CREDIT_EVENTS } from "../lib/gamification";
import { generatePostSummary, getPostSummary } from "../lib/aiSummary";
import { logger } from "../lib/logger";

const router = Router();

router.get("/communities/:communityId/posts", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const { userId: clerkId } = getAuth(req);

  const currentUser = clerkId ? await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1) : [];
  const currentUserId = currentUser[0]?.id;

  const posts = await db
    .select({ post: postsTable, author: usersTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.communityId, communityId))
    .orderBy(desc(postsTable.isPinned), desc(postsTable.createdAt));

  const result = await Promise.all(posts.map(async ({ post, author }) => {
    let hasUpvoted = false;
    if (currentUserId) {
      const upvote = await db.select().from(postUpvotesTable)
        .where(and(eq(postUpvotesTable.postId, post.id), eq(postUpvotesTable.userId, currentUserId))).limit(1);
      hasUpvoted = upvote.length > 0;
    }
    return {
      ...post, authorId: author.clerkId, authorName: author.displayName,
      authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted,
    };
  }));

  res.json(result);
});

router.post("/communities/:communityId/posts", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const { title, content, imageUrl } = req.body;

  const [post] = await db.insert(postsTable).values({
    communityId, authorId: user.id, title, content, imageUrl: imageUrl ?? null,
    isPinned: false, isBroadcast: false, upvoteCount: 0, commentCount: 0, viewCount: 0,
  }).returning();

  await db.insert(communityMembersTable).values({ communityId, userId: user.id }).onConflictDoNothing();
  await awardCredits(user.id, CREDIT_EVENTS.START_DISCUSSION);

  // Trigger AI summary generation asynchronously (non-blocking)
  generatePostSummary(post.id, title, content).catch(err => logger.error({ err }, "Failed to generate AI summary"));

  res.status(201).json({
    ...post, authorId: clerkId, authorName: user.displayName,
    authorAvatar: user.avatarUrl, authorLevel: user.level, hasUpvoted: false,
  });
});

router.get("/communities/:communityId/posts/pinned", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const { userId: clerkId } = getAuth(req);
  const currentUser = clerkId ? await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1) : [];
  const currentUserId = currentUser[0]?.id;

  const posts = await db
    .select({ post: postsTable, author: usersTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(and(eq(postsTable.communityId, communityId), eq(postsTable.isPinned, true)))
    .orderBy(desc(postsTable.createdAt));

  const result = await Promise.all(posts.map(async ({ post, author }) => {
    let hasUpvoted = false;
    if (currentUserId) {
      const upvote = await db.select().from(postUpvotesTable)
        .where(and(eq(postUpvotesTable.postId, post.id), eq(postUpvotesTable.userId, currentUserId))).limit(1);
      hasUpvoted = upvote.length > 0;
    }
    return {
      ...post, authorId: author.clerkId, authorName: author.displayName,
      authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted,
    };
  }));

  res.json(result);
});

router.get("/posts/:postId", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const { userId: clerkId } = getAuth(req);
  const currentUser = clerkId ? await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1) : [];
  const currentUserId = currentUser[0]?.id;

  const rows = await db
    .select({ post: postsTable, author: usersTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.id, postId))
    .limit(1);

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  const { post, author } = rows[0];

  // Increment view count (non-blocking)
  db.update(postsTable).set({ viewCount: sql`${postsTable.viewCount} + 1` }).where(eq(postsTable.id, postId)).catch(() => {});

  let hasUpvoted = false;
  if (currentUserId) {
    const upvote = await db.select().from(postUpvotesTable)
      .where(and(eq(postUpvotesTable.postId, post.id), eq(postUpvotesTable.userId, currentUserId))).limit(1);
    hasUpvoted = upvote.length > 0;
  }

  res.json({ ...post, authorId: author.clerkId, authorName: author.displayName, authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted });
});

router.get("/posts/:postId/ai-summary", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const summary = await getPostSummary(postId);
  if (!summary) { res.status(404).json({ error: "No summary yet" }); return; }
  res.json(summary);
});

router.patch("/posts/:postId", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const { title, content, imageUrl } = req.body;
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl;

  const [updated] = await db.update(postsTable).set(updates).where(eq(postsTable.id, postId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, updated.authorId)).limit(1);
  res.json({ ...updated, authorId: author.clerkId, authorName: author.displayName, authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted: false });
});

router.delete("/posts/:postId", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true });
});

router.patch("/posts/:postId/pin", requireModeratorOrAdmin, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const { isPinned } = req.body;

  const [updated] = await db.update(postsTable).set({ isPinned }).where(eq(postsTable.id, postId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, updated.authorId)).limit(1);
  res.json({ ...updated, authorId: author.clerkId, authorName: author.displayName, authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted: false });
});

router.post("/posts/:postId/upvote", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const existing = await db.select().from(postUpvotesTable)
    .where(and(eq(postUpvotesTable.postId, postId), eq(postUpvotesTable.userId, user.id))).limit(1);

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Not found" }); return; }

  if (existing.length > 0) {
    await db.delete(postUpvotesTable).where(and(eq(postUpvotesTable.postId, postId), eq(postUpvotesTable.userId, user.id)));
    const [updated] = await db.update(postsTable).set({ upvoteCount: Math.max(0, post.upvoteCount - 1) }).where(eq(postsTable.id, postId)).returning();
    res.json({ upvoteCount: updated.upvoteCount, hasUpvoted: false });
  } else {
    await db.insert(postUpvotesTable).values({ postId, userId: user.id }).onConflictDoNothing();
    const [updated] = await db.update(postsTable).set({ upvoteCount: post.upvoteCount + 1 }).where(eq(postsTable.id, postId)).returning();
    if (post.authorId !== user.id) {
      await awardCredits(post.authorId, CREDIT_EVENTS.RECEIVE_UPVOTE);
    }
    res.json({ upvoteCount: updated.upvoteCount, hasUpvoted: true });
  }
});

export default router;
