import { Router } from "express";
import { db, postsTable, usersTable, communitiesTable } from "@workspace/db";
import { ilike, or, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/search", requireAuth, async (req, res) => {
  const { q, type } = req.query as { q?: string; type?: string };
  if (!q) { res.json({ posts: [], members: [], totalCount: 0 }); return; }

  const pattern = `%${q}%`;
  let posts: any[] = [];
  let members: any[] = [];

  if (!type || type === "all" || type === "posts") {
    const postRows = await db
      .select({ post: postsTable, author: usersTable })
      .from(postsTable)
      .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
      .where(or(ilike(postsTable.title, pattern), ilike(postsTable.content, pattern)))
      .limit(20);

    posts = postRows.map(({ post, author }) => ({
      ...post, authorId: author.clerkId, authorName: author.displayName,
      authorAvatar: author.avatarUrl, authorLevel: author.level, hasUpvoted: false,
    }));
  }

  if (!type || type === "all" || type === "members") {
    const memberRows = await db.select().from(usersTable)
      .where(or(ilike(usersTable.displayName, pattern), ilike(usersTable.email, pattern)))
      .limit(20);

    members = memberRows.map(u => ({
      id: u.clerkId, clerkId: u.clerkId, displayName: u.displayName,
      email: u.email, avatarUrl: u.avatarUrl, role: u.role,
      isBanned: u.isBanned, healthCredits: u.healthCredits,
      level: u.level, weeklyCredits: u.weeklyCredits, createdAt: u.createdAt,
    }));
  }

  res.json({ posts, members, totalCount: posts.length + members.length });
});

export default router;
