import { db, usersTable, achievementsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const CREDIT_EVENTS = {
  START_DISCUSSION: 10,
  COMMENT: 5,
  RECEIVE_UPVOTE: 2,
};

export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 750, 1050, 1400, 1800, 2250, 2800];

export const LEVEL_NAMES = [
  "Newcomer", "Contributor", "Explorer", "Specialist", "Practitioner",
  "Expert", "Mentor", "Champion", "Insight Leader", "Health Pioneer"
];

export function calculateLevel(credits: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (credits >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 10);
}

export function getCreditsToNextLevel(credits: number, level: number): number {
  if (level >= 10) return 0;
  return LEVEL_THRESHOLDS[level] - credits;
}

export function getLevelProgress(credits: number, level: number): number {
  if (level >= 10) return 100;
  const start = LEVEL_THRESHOLDS[level - 1];
  const end = LEVEL_THRESHOLDS[level];
  return Math.round(((credits - start) / (end - start)) * 100);
}

export const BADGE_MILESTONES: { credits: number; name: string; description: string; icon: string }[] = [
  { credits: 50, name: "First Responder", description: "Reached 50 Health Credits", icon: "🏥" },
  { credits: 150, name: "Contributor", description: "Reached 150 Health Credits", icon: "📋" },
  { credits: 300, name: "Explorer", description: "Reached 300 Health Credits", icon: "🔬" },
  { credits: 500, name: "Specialist", description: "Reached 500 Health Credits", icon: "⚕️" },
  { credits: 750, name: "Practitioner", description: "Reached 750 Health Credits", icon: "💊" },
  { credits: 1050, name: "Expert", description: "Reached 1050 Health Credits", icon: "🎓" },
  { credits: 1400, name: "Mentor", description: "Reached 1400 Health Credits", icon: "🌟" },
  { credits: 1800, name: "Champion", description: "Reached 1800 Health Credits", icon: "🏆" },
  { credits: 2250, name: "Insight Leader", description: "Reached 2250 Health Credits", icon: "💡" },
  { credits: 2800, name: "Health Pioneer", description: "Reached 2800 Health Credits - Max Level!", icon: "🚀" },
];

export async function awardCredits(userId: number, amount: number) {
  const [updated] = await db
    .update(usersTable)
    .set({
      healthCredits: sql`${usersTable.healthCredits} + ${amount}`,
      weeklyCredits: sql`${usersTable.weeklyCredits} + ${amount}`,
    })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) return;

  const newLevel = calculateLevel(updated.healthCredits);
  if (newLevel !== updated.level) {
    await db.update(usersTable).set({ level: newLevel }).where(eq(usersTable.id, userId));
  }

  const existingAchievements = await db.select().from(achievementsTable).where(eq(achievementsTable.userId, userId));
  const earnedNames = new Set(existingAchievements.map(a => a.badgeName));

  for (const milestone of BADGE_MILESTONES) {
    if (updated.healthCredits >= milestone.credits && !earnedNames.has(milestone.name)) {
      await db.insert(achievementsTable).values({
        userId,
        badgeName: milestone.name,
        badgeDescription: milestone.description,
        badgeIcon: milestone.icon,
        earnedAt: new Date(),
      });
    }
  }
}
