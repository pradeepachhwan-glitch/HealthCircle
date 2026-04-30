import { Router } from "express";
import { getAuth , pstr } from "../lib/auth";
import { db, communitiesTable, communityMembersTable, usersTable, postsTable, commentsTable } from "@workspace/db";
import { eq, and, gte, count, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/communities", requireAuth, async (req, res) => {
  const { includeArchived } = req.query as { includeArchived?: string };
  const showArchived = includeArchived === "true";

  const { userId: clerkId } = getAuth(req);
  const user = clerkId ? await getOrCreateUser(clerkId) : null;

  const communities = await db.select().from(communitiesTable)
    .where(showArchived ? undefined : eq(communitiesTable.isArchived, false))
    .orderBy(communitiesTable.name);

  const result = await Promise.all(communities.map(async (c) => {
    const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));

    let isMember = false;
    if (user) {
      const [membership] = await db.select().from(communityMembersTable)
        .where(and(eq(communityMembersTable.communityId, c.id), eq(communityMembersTable.userId, user.id)));
      isMember = !!membership;
    }

    return { ...c, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0), isMember };
  }));

  res.json(result);
});

// 4 MB raw → ~5.5 MB base64. We validate the *string* length here as a cheap
// bound; the real per-file enforcement happens in /uploads/inline before we
// ever see the URL on this route.
const MAX_ICON_URL_CHARS = 6 * 1024 * 1024;

// Accept null, "" (treated as null), an https:// URL, or an image/* data URL.
// Anything else (javascript:, data:text/html, oversized blobs) is rejected to
// avoid persisting values that would break <img> rendering or smuggle scripts
// into surfaces that may one day use dangerouslySetInnerHTML.
function normalizeIconUrl(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "iconUrl must be a string" };
  if (value.length > MAX_ICON_URL_CHARS) return { ok: false, error: "iconUrl is too large" };
  if (value.startsWith("https://")) return { ok: true, value };
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/i.test(value)) return { ok: true, value };
  return { ok: false, error: "iconUrl must be an https URL or an image data URL" };
}

router.post("/communities", requireAdmin, async (req, res) => {
  const { name, slug, description, iconEmoji, iconUrl, coverColor, isPubliclyReadable } = req.body;
  const icon = normalizeIconUrl(iconUrl);
  if (!icon.ok) { res.status(400).json({ error: icon.error }); return; }
  const [community] = await db.insert(communitiesTable).values({
    name,
    slug,
    description: description ?? null,
    iconEmoji: iconEmoji ?? null,
    iconUrl: icon.value,
    coverColor: coverColor ?? null,
    isPubliclyReadable: typeof isPubliclyReadable === "boolean" ? isPubliclyReadable : false,
  }).returning();
  res.status(201).json({ ...community, memberCount: 0, postCount: 0, isMember: false });
});

router.get("/communities/:communityId", requireAuth, async (req, res) => {
  const communityId = parseInt(pstr(req.params.communityId), 10);
  const { userId: clerkId } = getAuth(req);
  const user = clerkId ? await getOrCreateUser(clerkId) : null;
  const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
  if (!community) { res.status(404).json({ error: "Not found" }); return; }
  const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, communityId));
  const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, communityId));
  let isMember = false;
  let hasPremiumAccess = false;
  if (user) {
    const [membership] = await db.select().from(communityMembersTable)
      .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, user.id)));
    isMember = !!membership;
    hasPremiumAccess = !!membership?.hasPremiumAccess;
  }
  res.json({ ...community, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0), isMember, hasPremiumAccess });
});

router.patch("/communities/:communityId", requireAdmin, async (req, res) => {
  const communityId = parseInt(pstr(req.params.communityId), 10);
  const { name, description, iconEmoji, iconUrl, coverColor, isArchived, isPubliclyReadable } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (iconEmoji !== undefined) updates.iconEmoji = iconEmoji;
  // Allow clearing the uploaded logo by passing null/empty string.
  if (iconUrl !== undefined) {
    const icon = normalizeIconUrl(iconUrl);
    if (!icon.ok) { res.status(400).json({ error: icon.error }); return; }
    updates.iconUrl = icon.value;
  }
  if (coverColor !== undefined) updates.coverColor = coverColor;
  if (isArchived !== undefined) updates.isArchived = isArchived;
  if (typeof isPubliclyReadable === "boolean") updates.isPubliclyReadable = isPubliclyReadable;

  const [updated] = await db.update(communitiesTable).set(updates).where(eq(communitiesTable.id, communityId)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  const [memberRes] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, communityId));
  const [postRes] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, communityId));
  res.json({ ...updated, memberCount: Number(memberRes?.count ?? 0), postCount: Number(postRes?.count ?? 0) });
});

router.delete("/communities/:communityId", requireAdmin, async (req, res) => {
  const communityId = parseInt(pstr(req.params.communityId), 10);
  await db.update(communitiesTable).set({ isArchived: true }).where(eq(communitiesTable.id, communityId));
  res.json({ success: true });
});

// Join a community
router.post("/communities/:communityId/join", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  const communityId = parseInt(pstr(req.params.communityId), 10);

  const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId));
  if (!community || community.isArchived) { res.status(404).json({ error: "Community not found" }); return; }

  await db.insert(communityMembersTable)
    .values({ communityId, userId: user.id })
    .onConflictDoNothing();

  res.json({ success: true, isMember: true });
});

// Leave a community
router.delete("/communities/:communityId/join", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);
  const communityId = parseInt(pstr(req.params.communityId), 10);

  await db.delete(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, user.id)));

  res.json({ success: true, isMember: false });
});

router.get("/communities/:communityId/stats", requireAuth, async (req, res) => {
  const communityId = parseInt(pstr(req.params.communityId), 10);
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
  const communityId = parseInt(pstr(req.params.communityId), 10);
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
