import { Router } from "express";
import { getAuth } from "../lib/auth";
import { db, commentsTable, usersTable, postsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { awardCredits, CREDIT_EVENTS } from "../lib/gamification";

const router = Router();

router.get("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const rows = await db
    .select({ comment: commentsTable, author: usersTable })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(eq(commentsTable.postId, postId))
    .orderBy(desc(commentsTable.createdAt));

  res.json(rows.map(({ comment, author }) => ({
    ...comment, authorId: author.clerkId, authorName: author.displayName,
    authorAvatar: author.avatarUrl, authorLevel: author.level,
  })));
});

router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = parseInt(req.params.postId);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const { content } = req.body;

  const [comment] = await db.insert(commentsTable).values({ postId, authorId: user.id, content }).returning();

  await db.update(postsTable).set({ commentCount: sql`${postsTable.commentCount} + 1` }).where(eq(postsTable.id, postId));
  await awardCredits(user.id, CREDIT_EVENTS.COMMENT);

  res.status(201).json({
    ...comment, authorId: clerkId, authorName: user.displayName,
    authorAvatar: user.avatarUrl, authorLevel: user.level,
  });
});

router.delete("/comments/:commentId", requireAuth, async (req, res) => {
  const commentId = parseInt(req.params.commentId);
  const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, commentId)).limit(1);
  if (comment) {
    await db.update(postsTable).set({ commentCount: sql`GREATEST(${postsTable.commentCount} - 1, 0)` }).where(eq(postsTable.id, comment.postId));
  }
  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
