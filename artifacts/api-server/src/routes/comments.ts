import { Router } from "express";
import { getAuth , pstr } from "../lib/auth";
import { db, commentsTable, usersTable, postsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { awardCredits, CREDIT_EVENTS } from "../lib/gamification";
import { generateYuktiCommentReply, mentionsYukti } from "../lib/yuktiReply";
import { sendPushToUser } from "../lib/pushNotifications";

const router = Router();

router.get("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = parseInt(pstr(req.params.postId), 10);
  const { userId: clerkId } = getAuth(req);
  const rows = await db
    .select({ comment: commentsTable, author: usersTable })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(eq(commentsTable.postId, postId))
    .orderBy(desc(commentsTable.createdAt));

  res.json(rows.map(({ comment, author }) => ({
    ...comment, authorId: author.clerkId, 
    authorName: comment.isAnonymous && author.clerkId !== clerkId ? "Anonymous Member" : author.displayName,
    authorAvatar: comment.isAnonymous && author.clerkId !== clerkId ? null : author.avatarUrl,
    authorLevel: author.level,
  })));
});

router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = parseInt(pstr(req.params.postId), 10);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const { content, isAnonymous } = req.body;

  const [comment] = await db.insert(commentsTable).values({ 
    postId, authorId: user.id, content,
    isAnonymous: !!isAnonymous,
  }).returning();

  await db.update(postsTable).set({ commentCount: sql`${postsTable.commentCount} + 1` }).where(eq(postsTable.id, postId));
  await awardCredits(user.id, CREDIT_EVENTS.COMMENT);

  // If the comment mentions @askYukti, trigger an async Yukti reply
  if (mentionsYukti(content)) {
    const [post] = await db.select({ title: postsTable.title, content: postsTable.content }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post) {
      generateYuktiCommentReply(postId, content, post.title, post.content).catch(() => {});
    }
  } else {
    // Notify the post author about the new comment
    const [post] = await db.select({ authorId: postsTable.authorId, title: postsTable.title }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post && post.authorId !== user.id) {
      sendPushToUser(post.authorId, {
        title: "New reply on your post",
        body: `${user.displayName}: ${content.slice(0, 80)}${content.length > 80 ? "..." : ""}`,
        url: `/post/${postId}`,
      }).catch(() => {});
    }
  }

  res.status(201).json({
    ...comment, authorId: clerkId, authorName: user.displayName,
    authorAvatar: user.avatarUrl, authorLevel: user.level,
  });
});

router.delete("/comments/:commentId", requireAuth, async (req, res) => {
  const commentId = parseInt(pstr(req.params.commentId), 10);
  const [comment] = await db.select().from(commentsTable).where(eq(commentsTable.id, commentId)).limit(1);
  if (comment) {
    await db.update(postsTable).set({ commentCount: sql`GREATEST(${postsTable.commentCount} - 1, 0)` }).where(eq(postsTable.id, comment.postId));
  }
  await db.delete(commentsTable).where(eq(commentsTable.id, commentId));
  res.json({ success: true });
});

export default router;
