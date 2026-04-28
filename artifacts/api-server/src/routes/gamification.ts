import { Router } from "express";
import { db, usersTable, achievementsTable, postsTable, commentsTable } from "@workspace/db";
import { eq, desc, gte, sql } from "drizzle-orm";
import { getAuth, requireAuth } from "../lib/auth";
import { calculateLevel, getLevelProgress, getCreditsToNextLevel, LEVEL_NAMES } from "../lib/gamification";

const router = Router();

router.get("/communities/:communityId/leaderboard", requireAuth, async (req, res) => {
  const communityId = parseInt(req.params.communityId);
  const { period } = req.query as { period?: string };
  const isWeekly = period === "weekly";

  const creditField = isWeekly ? usersTable.weeklyCredits : usersTable.healthCredits;

  const result = await db
    .selectDistinct({
      userId: usersTable.clerkId,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      level: usersTable.level,
      credits: creditField,
    })
    .from(usersTable)
    .innerJoin(postsTable, eq(postsTable.authorId, usersTable.id))
    .where(eq(postsTable.communityId, communityId))
    .orderBy(desc(creditField))
    .limit(20);

  const withBadges = await Promise.all(result.map(async (u, i) => {
    const [badgeCount] = await db.select({ count: sql<number>`count(*)` }).from(achievementsTable).where(eq(achievementsTable.userId, sql`(SELECT id FROM users WHERE clerk_id = ${u.userId})`));
    return {
      rank: i + 1,
      userId: u.userId,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      level: u.level,
      credits: Number(u.credits ?? 0),
      badgeCount: Number(badgeCount?.count ?? 0),
    };
  }));

  res.json(withBadges);
});

router.get("/users/:userId/achievements", requireAuth, async (req, res) => {
  const clerkId = req.params.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const achievements = await db.select().from(achievementsTable)
    .where(eq(achievementsTable.userId, user.id))
    .orderBy(desc(achievementsTable.earnedAt));

  res.json(achievements.map(a => ({
    ...a,
    userId: clerkId,
  })));
});

router.get("/users/me/credits-summary", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user) { res.status(404).json({ error: "Not found" }); return; }

  const level = calculateLevel(user.healthCredits);
  const levelName = LEVEL_NAMES[level - 1] ?? "Health Pioneer";
  const creditsToNextLevel = getCreditsToNextLevel(user.healthCredits, level);
  const progressPercent = getLevelProgress(user.healthCredits, level);

  const recentBadges = await db.select().from(achievementsTable)
    .where(eq(achievementsTable.userId, user.id))
    .orderBy(desc(achievementsTable.earnedAt))
    .limit(3);

  res.json({
    userId: clerkId,
    healthCredits: user.healthCredits,
    weeklyCredits: user.weeklyCredits,
    level,
    levelName,
    creditsToNextLevel,
    progressPercent,
    recentBadges: recentBadges.map(b => ({ ...b, userId: clerkId })),
  });
});

export default router;
