import { Router } from "express";
import { db, usersTable, communitiesTable, postsTable, commentsTable, communityMembersTable, aiSummariesTable, tcConsultations, doctorsTable, auditLogTable } from "@workspace/db";
import { count, eq, gte, desc, and, sql, or, ilike, inArray } from "drizzle-orm";
import { getAuth, requireAdmin, pstr } from "../lib/auth";
import { normaliseContentFields } from "../lib/contentMeta";
import { aiChat } from "../lib/aiClient";
import { logger } from "../lib/logger";
import { recordAudit } from "../lib/audit";

const router = Router();

router.post("/admin/broadcast", requireAdmin, async (req, res) => {
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

  // Optional in-app content payload — videos, articles, audio. When absent
  // (legacy broadcasts) the helper returns all-null, preserving the existing
  // discussion-style behaviour exactly.
  const contentFields = normaliseContentFields(req.body);

  const insertedPosts = await Promise.all(targetCommunityIds.map(communityId =>
    db.insert(postsTable).values({
      communityId, authorId: admin.id, title, content,
      isPinned: false, isBroadcast: true, upvoteCount: 0, commentCount: 0,
      ...contentFields,
    }).returning()
  ));
  res.status(201).json({ postsCreated: insertedPosts.length, communityIds: targetCommunityIds });
});

// ─── Content summary helper ──────────────────────────────────────────────
// Used by the broadcast UI to pre-fill an AI summary for the attached video/
// article/audio so admins don't have to write one from scratch. Stays admin-
// gated because it consumes paid tokens; output is plain text (not the
// structured Yukti contract) since this is editorial copy, not medical advice.
router.post("/admin/content/summarize", requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as {
    title?: unknown;
    url?: unknown;
    contentType?: unknown;
    transcript?: unknown;
  };

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 280) : "";
  if (!title) { res.status(400).json({ error: "title is required" }); return; }
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2048) : "";
  const contentType = typeof body.contentType === "string" ? body.contentType.trim().slice(0, 32) : "content";
  const transcript = typeof body.transcript === "string" ? body.transcript.trim().slice(0, 8000) : "";

  const userPrompt = [
    `Write a concise 2-3 sentence neutral summary of this ${contentType} for an Indian healthcare-app user.`,
    `Title: ${title}`,
    url ? `URL: ${url}` : "",
    transcript ? `Excerpt / transcript:\n${transcript}` : "",
    "Stay factual, do not invent claims, do not give medical advice, do not include emojis or markdown.",
  ].filter(Boolean).join("\n\n");

  const result = await aiChat({
    systemPrompt: "You are an editorial assistant for HealthCircle, an Indian healthcare super-app. You produce short, neutral, factual summaries of health-related videos and articles. You never give medical advice — your job is purely descriptive editorial copy.",
    userPrompt,
    history: [],
    timeoutMs: 12000,
    maxTokens: 220,
    jsonMode: false,
  });

  if (!result.ok) {
    logger.warn({ err: result.error }, "content summarize failed");
    res.status(503).json({ error: "AI service unavailable" }); return;
  }
  const summary = result.text.trim().replace(/^["']|["']$/g, "").slice(0, 800);
  res.json({ summary });
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [userCount] = await db.select({ count: count() }).from(usersTable);
  const [bannedCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.isBanned, true));
  const [medProCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "medical_professional"));
  const [communityCount] = await db.select({ count: count() }).from(communitiesTable).where(eq(communitiesTable.isArchived, false));
  const [postCount] = await db.select({ count: count() }).from(postsTable);
  const [commentCount] = await db.select({ count: count() }).from(commentsTable);
  const [weeklyUsers] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.updatedAt, oneWeekAgo));
  const [newUsersCount] = await db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, oneWeekAgo));
  const [todayPosts] = await db.select({ count: count() }).from(postsTable).where(gte(postsTable.createdAt, oneDayAgo));
  const [pendingAI] = await db.select({ count: count() }).from(aiSummariesTable).where(eq(aiSummariesTable.status, "pending"));
  const [approvedAI] = await db.select({ count: count() }).from(aiSummariesTable).where(eq(aiSummariesTable.status, "approved"));

  const totalCredits = await db.select({ total: sql<number>`SUM(health_credits)` }).from(usersTable);
  const totalHC = Number(totalCredits[0]?.total ?? 0);

  // DAU/WAU/MAU: distinct users with any meaningful activity in the window.
  // We union across the high-signal user-action tables so a user counts as
  // active if they posted, commented, asked Yukti, or ran a search. Logging
  // in alone (no action) doesn't count — that would inflate the numbers.
  const activeUsersResult = await db.execute<{ dau: number; wau: number; mau: number }>(sql`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')   AS dau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS wau,
      COUNT(DISTINCT user_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS mau
    FROM (
      SELECT author_id AS user_id, created_at FROM posts
      UNION ALL
      SELECT author_id AS user_id, created_at FROM comments
      UNION ALL
      SELECT user_id, created_at FROM search_logs WHERE user_id IS NOT NULL
      UNION ALL
      SELECT s.user_id, m.created_at
        FROM health_chat_messages m
        JOIN health_chat_sessions s ON s.id = m.session_id
       WHERE m.role = 'user'
    ) AS activity
  `);
  const activeUsers = activeUsersResult.rows?.[0];
  const dau = Number(activeUsers?.dau ?? 0);
  const wau = Number(activeUsers?.wau ?? 0);
  const mau = Number(activeUsers?.mau ?? 0);

  const communities = await db.select().from(communitiesTable).where(eq(communitiesTable.isArchived, false)).orderBy(desc(communitiesTable.createdAt));
  const topCommunities = await Promise.all(communities.map(async (c) => {
    const [mc] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [pc] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));
    return { ...c, memberCount: Number(mc?.count ?? 0), postCount: Number(pc?.count ?? 0) };
  }));

  const roleBreakdown = await db
    .select({ role: usersTable.role, count: count() })
    .from(usersTable)
    .groupBy(usersTable.role);

  res.json({
    totalUsers: Number(userCount?.count ?? 0),
    bannedUsers: Number(bannedCount?.count ?? 0),
    medProCount: Number(medProCount?.count ?? 0),
    totalCommunities: Number(communityCount?.count ?? 0),
    totalPosts: Number(postCount?.count ?? 0),
    totalComments: Number(commentCount?.count ?? 0),
    weeklyActiveUsers: Number(weeklyUsers?.count ?? 0),
    newUsersThisWeek: Number(newUsersCount?.count ?? 0),
    dau,
    wau,
    mau,
    todayPosts: Number(todayPosts?.count ?? 0),
    pendingAISummaries: Number(pendingAI?.count ?? 0),
    approvedAISummaries: Number(approvedAI?.count ?? 0),
    totalHealthCreditsAwarded: totalHC,
    topCommunities,
    roleBreakdown: roleBreakdown.map(r => ({ role: r.role, count: Number(r.count) })),
  });
});

router.get("/admin/communities", requireAdmin, async (req, res) => {
  const communities = await db.select().from(communitiesTable).orderBy(desc(communitiesTable.createdAt));
  const result = await Promise.all(communities.map(async (c) => {
    const [mc] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [pc] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));
    return { ...c, memberCount: Number(mc?.count ?? 0), postCount: Number(pc?.count ?? 0) };
  }));
  res.json(result);
});

router.patch("/admin/communities/:id", requireAdmin, async (req, res) => {
  const id = Number(pstr(req.params.id));
  const { isArchived, name, description } = req.body;
  const updates: Record<string, unknown> = {};
  if (isArchived !== undefined) updates.isArchived = isArchived;
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  const [updated] = await db.update(communitiesTable).set(updates).where(eq(communitiesTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Community not found" }); return; }
  res.json(updated);
});

router.get("/admin/communities/:id/members", requireAdmin, async (req, res) => {
  const communityId = Number(pstr(req.params.id));
  const members = await db
    .select({ user: usersTable, member: communityMembersTable })
    .from(communityMembersTable)
    .innerJoin(usersTable, eq(communityMembersTable.userId, usersTable.id))
    .where(eq(communityMembersTable.communityId, communityId))
    .orderBy(desc(communityMembersTable.joinedAt));

  res.json(members.map(({ user, member }) => ({
    userId: user.clerkId,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isBanned: user.isBanned,
    joinedAt: member.joinedAt,
  })));
});

router.delete("/admin/communities/:id/members/:userId", requireAdmin, async (req, res) => {
  const communityId = Number(pstr(req.params.id));
  const clerkId = pstr(req.params.userId);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  await db.delete(communityMembersTable).where(and(
    eq(communityMembersTable.communityId, communityId),
    eq(communityMembersTable.userId, user.id)
  ));
  res.json({ success: true });
});

/**
 * Add one or more members to a community by clerkId or email (WhatsApp-style).
 * Body: { userIds?: string[], emails?: string[] }
 * Returns: { added: [{userId, displayName, email}], notFound: string[] }
 */
router.post("/admin/communities/:id/members", requireAdmin, async (req, res) => {
  const communityId = Number(pstr(req.params.id));
  if (!Number.isInteger(communityId)) { res.status(400).json({ error: "Invalid community id" }); return; }

  const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
  if (!community) { res.status(404).json({ error: "Community not found" }); return; }

  const userIds: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  const emails: string[] = Array.isArray(req.body?.emails) ? req.body.emails : [];
  if (!userIds.length && !emails.length) {
    res.status(400).json({ error: "Provide userIds or emails" });
    return;
  }

  // Build the OR predicate from only the populated lookup lists. Mixing a raw
  // `sql\`false\`` placeholder with `inArray()` confuses the Drizzle types, so
  // we collect typed conditions first and pass them explicitly to `or(...)`.
  const lookupConditions = [];
  if (userIds.length) lookupConditions.push(inArray(usersTable.clerkId, userIds));
  if (emails.length) lookupConditions.push(inArray(usersTable.email, emails));
  const found = await db
    .select()
    .from(usersTable)
    .where(lookupConditions.length === 1 ? lookupConditions[0] : or(...lookupConditions));

  const foundClerkIds = new Set(found.map(u => u.clerkId));
  const foundEmails = new Set(found.map(u => u.email).filter(Boolean) as string[]);
  const notFound: string[] = [
    ...userIds.filter(id => !foundClerkIds.has(id)),
    ...emails.filter(e => !foundEmails.has(e)),
  ];

  const added: Array<{ userId: string; displayName: string; email: string | null }> = [];
  for (const user of found) {
    const result = await db.insert(communityMembersTable)
      .values({ communityId, userId: user.id })
      .onConflictDoNothing()
      .returning();
    if (result.length) {
      added.push({ userId: user.clerkId, displayName: user.displayName, email: user.email });
    }
  }

  res.status(201).json({ added, notFound, alreadyMember: found.length - added.length });
});

/**
 * Search users for the "add members" picker. Matches displayName/email (case-insensitive).
 * Query: ?q=string (>= 2 chars), &limit=10 (default)
 */
router.get("/admin/users/search", requireAdmin, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit ?? 10) || 10, 50);
  if (q.length < 2) { res.json([]); return; }
  const like = `%${q}%`;
  const rows = await db
    .select({ clerkId: usersTable.clerkId, displayName: usersTable.displayName, email: usersTable.email, avatarUrl: usersTable.avatarUrl, role: usersTable.role })
    .from(usersTable)
    .where(or(ilike(usersTable.displayName, like), ilike(usersTable.email, like)))
    .limit(limit);
  res.json(rows);
});

router.get("/admin/posts", requireAdmin, async (req, res) => {
  const page = Number(req.query.page ?? 1);
  const limit = 50;
  const offset = (page - 1) * limit;

  const posts = await db
    .select({ post: postsTable, author: usersTable, community: communitiesTable })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .innerJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(limit).offset(offset);

  res.json(posts.map(({ post, author, community }) => ({
    ...post,
    authorName: author.displayName,
    authorAvatar: author.avatarUrl,
    communityName: community.name,
    communitySlug: community.slug,
  })));
});

router.patch("/admin/posts/:id", requireAdmin, async (req, res) => {
  const postId = Number(pstr(req.params.id));
  const { isPinned, isModerated, isBroadcast } = req.body;
  const updates: Record<string, unknown> = {};
  if (isPinned !== undefined) updates.isPinned = isPinned;
  if (isModerated !== undefined) updates.isModerated = isModerated;
  if (isBroadcast !== undefined) updates.isBroadcast = isBroadcast;
  const [updated] = await db.update(postsTable).set(updates).where(eq(postsTable.id, postId)).returning();
  if (!updated) { res.status(404).json({ error: "Post not found" }); return; }
  res.json(updated);
});

router.delete("/admin/posts/:id", requireAdmin, async (req, res) => {
  const postId = Number(pstr(req.params.id));
  await db.delete(postsTable).where(eq(postsTable.id, postId));
  res.json({ success: true });
});

router.get("/admin/ai-summaries", requireAdmin, async (req, res) => {
  const status = req.query.status as string | undefined;
  let query = db
    .select({ summary: aiSummariesTable, post: postsTable })
    .from(aiSummariesTable)
    .innerJoin(postsTable, eq(aiSummariesTable.postId, postsTable.id))
    .orderBy(desc(aiSummariesTable.createdAt))
    .$dynamic();

  if (status) {
    query = query.where(eq(aiSummariesTable.status, status as "pending" | "approved" | "rejected" | "edited"));
  }

  const results = await query.limit(100);
  res.json(results.map(({ summary, post }) => ({
    ...summary,
    postTitle: post.title,
    postCommunityId: post.communityId,
  })));
});

router.post("/admin/credits/award", requireAdmin, async (req, res) => {
  const { userId, amount, reason } = req.body;
  if (!userId || !amount) { res.status(400).json({ error: "userId and amount required" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.clerkId, userId)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [updated] = await db.update(usersTable).set({
    healthCredits: user.healthCredits + amount,
  }).where(eq(usersTable.clerkId, userId)).returning();
  res.json({ success: true, newBalance: updated.healthCredits, reason });
});

router.patch("/admin/users/:userId/verify-pro", requireAdmin, async (req, res) => {
  const clerkId = pstr(req.params.userId);
  const { isVerifiedPro } = req.body;
  const [updated] = await db.update(usersTable)
    .set({ isVerifiedPro: !!isVerifiedPro })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  await recordAudit(req, "user.verify_pro", { type: "user", id: updated.id }, { isVerifiedPro: !!isVerifiedPro });
  res.json({ success: true, user: updated });
});

router.patch("/admin/users/:clerkId/role", requireAdmin, async (req, res) => {
  const clerkId = pstr(req.params.clerkId);
  const { role } = req.body;
  const validRoles = ["admin", "moderator", "medical_professional", "member"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" }); return;
  }
  const [updated] = await db.update(usersTable)
    .set({ role, isVerifiedPro: role === "medical_professional" ? true : false })
    .where(eq(usersTable.clerkId, clerkId))
    .returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  await recordAudit(req, "user.role_change", { type: "user", id: updated.id }, { newRole: role });
  res.json({ success: true, user: updated });
});

router.get("/admin/consultations/stats", requireAdmin, async (req, res) => {
  const { count: countFn } = await import("drizzle-orm");
  const { doctorConsultationsTable } = await import("@workspace/db");
  const [pending] = await db.select({ count: countFn() }).from(doctorConsultationsTable).where(eq(doctorConsultationsTable.status as any, "pending"));
  const [total] = await db.select({ count: countFn() }).from(doctorConsultationsTable);
  res.json({ pending: Number(pending?.count ?? 0), total: Number(total?.count ?? 0) });
});

// ─── Tele-Consult oversight ────────────────────────────────────────────────

const TC_STATUSES = ["pending", "scheduled", "in_progress", "completed", "cancelled", "no_show"];

router.get("/admin/teleconsult/consultations", requireAdmin, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const where = status && TC_STATUSES.includes(status)
    ? eq(tcConsultations.status, status)
    : undefined;
  const rows = await db
    .select({
      consultation: tcConsultations,
      patient: {
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
      },
      doctor: {
        id: doctorsTable.id,
        name: doctorsTable.name,
        specialty: doctorsTable.specialty,
      },
    })
    .from(tcConsultations)
    .leftJoin(usersTable, eq(usersTable.id, tcConsultations.userId))
    .leftJoin(doctorsTable, eq(doctorsTable.id, tcConsultations.doctorId))
    .where(where as any)
    .orderBy(desc(tcConsultations.createdAt))
    .limit(200);
  res.json({ consultations: rows });
});

router.get("/admin/teleconsult/stats", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      status: tcConsultations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(tcConsultations)
    .groupBy(tcConsultations.status);
  const stats: Record<string, number> = {};
  for (const s of TC_STATUSES) stats[s] = 0;
  for (const r of rows) stats[r.status] = Number(r.count);
  res.json({ stats });
});

router.patch("/admin/teleconsult/consultations/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const status = typeof req.body?.status === "string" ? req.body.status : null;
  if (!status || !TC_STATUSES.includes(status)) {
    res.status(400).json({ error: "Invalid status" }); return;
  }
  const notesPatch = typeof req.body?.notes === "string" ? req.body.notes : null;
  const set: Record<string, unknown> = { status, updatedAt: new Date() };
  if (notesPatch !== null) set.notes = notesPatch;
  const [updated] = await db
    .update(tcConsultations)
    .set(set as any)
    .where(eq(tcConsultations.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, "teleconsult.update", { type: "tc_consultation", id }, { status, notesChanged: notesPatch !== null });
  res.json({ consultation: updated });
});

// ─── Audit log viewer ──────────────────────────────────────────────────────

router.get("/admin/audit-log", requireAdmin, async (req, res) => {
  const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
  const action = typeof req.query.action === "string" && req.query.action.trim() ? req.query.action.trim() : null;
  const where = action ? eq(auditLogTable.action, action) : undefined;

  const rows = await db
    .select({
      entry: auditLogTable,
      actor: {
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        role: usersTable.role,
      },
    })
    .from(auditLogTable)
    .leftJoin(usersTable, eq(usersTable.id, auditLogTable.actorUserId))
    .where(where as any)
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit);

  res.json({ entries: rows });
});

export default router;
