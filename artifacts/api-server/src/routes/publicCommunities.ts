import { Router } from "express";
import { db, communitiesTable, postsTable, commentsTable, communityMembersTable, usersTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { pstr } from "../lib/auth";
import { summarizeReactionsForPosts } from "./posts";

const router = Router();

/**
 * Public, unauthenticated read-only endpoints for communities the admin has
 * opted in to public discovery (`communities.is_publicly_readable = true`
 * AND `is_archived = false`).
 *
 * All write actions (posting, reacting, commenting, joining) remain auth-gated
 * via the existing /communities, /posts, /comments routers — nothing here
 * mutates state. Per-user fields (hasUpvoted, hasBookmarked, reactions.mine)
 * are intentionally omitted/forced to false because there is no user context.
 *
 * We always look communities up by `slug` (never by numeric id) so we don't
 * expose an enumerable internal id surface to the world.
 */

/** Shared filter: only surface communities admins have explicitly made public. */
const publiclyReadableFilter = and(
  eq(communitiesTable.isPubliclyReadable, true),
  eq(communitiesTable.isArchived, false),
);

/** GET /public/communities — list every publicly readable community. */
router.get("/public/communities", async (_req, res) => {
  const communities = await db.select().from(communitiesTable)
    .where(publiclyReadableFilter)
    .orderBy(communitiesTable.name);

  const result = await Promise.all(communities.map(async (c) => {
    const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));
    return { ...c, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0) };
  }));

  res.json(result);
});

/** GET /public/communities/:slug — single publicly readable community. */
router.get("/public/communities/:slug", async (req, res) => {
  const slug = pstr(req.params.slug);
  const [community] = await db.select().from(communitiesTable)
    .where(and(eq(communitiesTable.slug, slug), publiclyReadableFilter))
    .limit(1);
  if (!community) { res.status(404).json({ error: "Not found" }); return; }
  const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, community.id));
  const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, community.id));
  res.json({
    ...community,
    memberCount: Number(memberRes?.count ?? 0),
    postCount: Number(postRes?.count ?? 0),
  });
});

/**
 * Public response shaping helpers.
 *
 * Two deliberate omissions vs. the authed endpoints:
 *  1. `authorId` (a.k.a. clerkId) is NOT included. clerkId is a user-linkable
 *     identifier; exposing it to the open internet would invite enumeration
 *     and cross-site correlation. Public consumers get displayName/avatar/level
 *     only — enough to render a card, not enough to track a person.
 *  2. Per-user fields (`hasUpvoted`, `hasBookmarked`, `reactions.mine`) are
 *     fixed to false/null because there is no logged-in user.
 */

/** GET /public/communities/:slug/posts — posts in a publicly readable community. */
router.get("/public/communities/:slug/posts", async (req, res) => {
  const slug = pstr(req.params.slug);
  const [community] = await db.select({ id: communitiesTable.id }).from(communitiesTable)
    .where(and(eq(communitiesTable.slug, slug), publiclyReadableFilter))
    .limit(1);
  if (!community) { res.status(404).json({ error: "Not found" }); return; }

  const posts = await db
    .select({ post: postsTable, author: usersTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .where(and(
      eq(postsTable.communityId, community.id),
      // Hide posts that an admin has moderated/hidden — they should never
      // surface to anonymous visitors.
      eq(postsTable.isModerated, false),
    ))
    .orderBy(desc(postsTable.isPinned), desc(postsTable.createdAt));

  const postIds = posts.map(p => p.post.id);
  const reactionSummary = await summarizeReactionsForPosts(postIds, undefined);

  const result = posts.map(({ post, author }) => ({
    ...post,
    authorName: author.displayName,
    authorAvatar: author.avatarUrl,
    authorLevel: author.level,
    hasUpvoted: false,
    hasBookmarked: false,
    reactions: reactionSummary[post.id] ?? { counts: {}, total: 0, mine: null },
  }));

  res.json(result);
});

/**
 * GET /public/posts/:postId — single post, only if it belongs to a
 * publicly readable, non-archived community AND has not been moderated.
 * View count is NOT incremented here to avoid letting bots inflate stats
 * on the open internet.
 */
router.get("/public/posts/:postId", async (req, res) => {
  const postId = parseInt(pstr(req.params.postId), 10);
  if (!Number.isFinite(postId)) { res.status(404).json({ error: "Not found" }); return; }

  const rows = await db
    .select({ post: postsTable, author: usersTable, community: communitiesTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .innerJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
    .where(and(
      eq(postsTable.id, postId),
      eq(postsTable.isModerated, false),
      eq(communitiesTable.isPubliclyReadable, true),
      eq(communitiesTable.isArchived, false),
    ))
    .limit(1);

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  const { post, author } = rows[0];

  const reactionSummary = await summarizeReactionsForPosts([post.id], undefined);

  res.json({
    ...post,
    authorName: author.displayName,
    authorAvatar: author.avatarUrl,
    authorLevel: author.level,
    hasUpvoted: false,
    hasBookmarked: false,
    reactions: reactionSummary[post.id] ?? { counts: {}, total: 0, mine: null },
  });
});

/** GET /public/posts/:postId/comments — comments on a public, non-moderated post. */
router.get("/public/posts/:postId/comments", async (req, res) => {
  const postId = parseInt(pstr(req.params.postId), 10);
  if (!Number.isFinite(postId)) { res.status(404).json({ error: "Not found" }); return; }

  // Verify the post lives in a publicly readable community AND is itself
  // not moderated, before exposing its comment thread.
  const [gate] = await db.select({ id: postsTable.id }).from(postsTable)
    .innerJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
    .where(and(
      eq(postsTable.id, postId),
      eq(postsTable.isModerated, false),
      eq(communitiesTable.isPubliclyReadable, true),
      eq(communitiesTable.isArchived, false),
    ))
    .limit(1);
  if (!gate) { res.status(404).json({ error: "Not found" }); return; }

  const rows = await db
    .select({ comment: commentsTable, author: usersTable })
    .from(commentsTable)
    .innerJoin(usersTable, eq(commentsTable.authorId, usersTable.id))
    .where(eq(commentsTable.postId, postId))
    .orderBy(desc(commentsTable.createdAt));

  res.json(rows.map(({ comment, author }) => ({
    ...comment,
    authorName: author.displayName,
    authorAvatar: author.avatarUrl,
    authorLevel: author.level,
  })));
});

export default router;
