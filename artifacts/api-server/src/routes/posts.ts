import { Router } from "express";
import { getAuth } from "../lib/auth";
import { db, postsTable, usersTable, commentsTable, postUpvotesTable, postReactionsTable, communityMembersTable, doctorConsultationsTable } from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAuth, requireModeratorOrAdmin, getOrCreateUser } from "../lib/auth";
import { awardCredits, CREDIT_EVENTS } from "../lib/gamification";
import { generatePostSummary, getPostSummary } from "../lib/aiSummary";
import { generateYuktiPostReply, mentionsYukti } from "../lib/yuktiReply";
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

  const reactionSummary = await summarizeReactionsForPosts(posts.map(p => p.post.id), currentUserId);

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
      reactions: reactionSummary[post.id] ?? { counts: {}, total: 0, mine: null },
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

  // If the post mentions @askYukti, trigger an async Yukti reply
  if (mentionsYukti(title) || mentionsYukti(content)) {
    generateYuktiPostReply(post.id, title, content).catch(err => logger.error({ err }, "Yukti post reply failed"));
  }

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

  const reactionSummary = await summarizeReactionsForPosts(posts.map(p => p.post.id), currentUserId);

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
      reactions: reactionSummary[post.id] ?? { counts: {}, total: 0, mine: null },
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

  const reactionSummary = await summarizeReactionsForPosts([post.id], currentUserId);

  res.json({
    ...post, authorId: author.clerkId, authorName: author.displayName,
    authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted,
    reactions: reactionSummary[post.id] ?? { counts: {}, total: 0, mine: null },
  });
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

router.post("/posts/:postId/request-consultation", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const { reason, riskLevel } = req.body;

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  const existing = await db.select().from(doctorConsultationsTable)
    .where(and(eq(doctorConsultationsTable.postId, postId), eq(doctorConsultationsTable.userId, user.id))).limit(1);
  if (existing.length > 0) {
    res.json({ success: true, consultation: existing[0], alreadyExists: true });
    return;
  }

  const [consultation] = await db.insert(doctorConsultationsTable).values({
    userId: user.id,
    postId,
    riskLevel: riskLevel ?? "high",
    reason: reason ?? "User requested professional review",
    status: "pending",
    source: "user_request",
  }).returning();

  res.status(201).json({ success: true, consultation });
});

// ─── Reactions (Facebook/LinkedIn-style) ──────────────────────────────────

const ALLOWED_REACTIONS = ["like", "love", "care", "insightful", "celebrate", "sad"] as const;
type ReactionEmoji = typeof ALLOWED_REACTIONS[number];

/**
 * Group reaction rows for a set of post IDs into a per-post summary.
 * Output: { [postId]: { counts: { emoji: count }, total, mine?: emoji } }
 */
async function summarizeReactionsForPosts(postIds: number[], currentUserId?: number) {
  const out: Record<number, { counts: Record<string, number>; total: number; mine: string | null }> = {};
  if (!postIds.length) return out;
  for (const id of postIds) out[id] = { counts: {}, total: 0, mine: null };

  const rows = await db
    .select({ postId: postReactionsTable.postId, emoji: postReactionsTable.emoji, userId: postReactionsTable.userId })
    .from(postReactionsTable)
    .where(inArray(postReactionsTable.postId, postIds));

  for (const r of rows) {
    const bucket = out[r.postId];
    if (!bucket) continue;
    bucket.counts[r.emoji] = (bucket.counts[r.emoji] ?? 0) + 1;
    bucket.total += 1;
    if (currentUserId && r.userId === currentUserId) bucket.mine = r.emoji;
  }
  return out;
}

/** GET reactions for a single post: counts + which emoji the current user reacted with. */
router.get("/posts/:postId/reactions", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  if (!Number.isInteger(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { userId: clerkId } = getAuth(req);
  const me = clerkId ? await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1) : [];
  const summary = await summarizeReactionsForPosts([postId], me[0]?.id);
  res.json(summary[postId] ?? { counts: {}, total: 0, mine: null });
});

/** Toggle/replace a reaction for the current user. Body: { emoji } or null to remove. */
router.post("/posts/:postId/react", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  if (!Number.isInteger(postId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const emoji: string | null = req.body?.emoji ?? null;
  if (emoji !== null && !ALLOWED_REACTIONS.includes(emoji as ReactionEmoji)) {
    res.status(400).json({ error: "Invalid emoji", allowed: ALLOWED_REACTIONS });
    return;
  }

  const user = await getOrCreateUser(clerkId);

  // Confirm the post exists (cheap check, also gives us authorId for credits later).
  const [post] = await db.select({ id: postsTable.id, authorId: postsTable.authorId })
    .from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }

  // Find current reaction (if any). This read is informational — all writes
  // below are concurrency-safe via DELETE-by-key (idempotent) or upsert via
  // ON CONFLICT, so two simultaneous taps cannot 500 on a PK violation.
  const [existing] = await db
    .select()
    .from(postReactionsTable)
    .where(and(eq(postReactionsTable.postId, postId), eq(postReactionsTable.userId, user.id)))
    .limit(1);

  const isToggleOff = emoji === null || (existing && existing.emoji === emoji);

  if (isToggleOff) {
    // Idempotent DELETE — safe under concurrent toggles.
    await db.delete(postReactionsTable)
      .where(and(eq(postReactionsTable.postId, postId), eq(postReactionsTable.userId, user.id)));
  } else {
    // Atomic upsert: insert if absent, replace emoji if present. Last write wins.
    await db.insert(postReactionsTable)
      .values({ postId, userId: user.id, emoji: emoji as string })
      .onConflictDoUpdate({
        target: [postReactionsTable.postId, postReactionsTable.userId],
        set: { emoji: emoji as string, createdAt: new Date() },
      });

    // Award a credit only on first-time reaction (when there was no prior row).
    if (!existing && post.authorId !== user.id) {
      await awardCredits(post.authorId, CREDIT_EVENTS.RECEIVE_UPVOTE).catch(() => {});
    }
  }

  const summary = await summarizeReactionsForPosts([postId], user.id);
  res.json(summary[postId] ?? { counts: {}, total: 0, mine: null });
});

export { summarizeReactionsForPosts };
export default router;
