import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, communitiesTable, postsTable, aiSummariesTable, communityMembersTable, commentsTable, doctorConsultationsTable } from "@workspace/db";
import { eq, desc, and, count, inArray, or } from "drizzle-orm";
import { requireMedPro, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/medpro/communities", requireMedPro, async (req, res) => {
  const communities = await db.select().from(communitiesTable)
    .where(eq(communitiesTable.isArchived, false))
    .orderBy(desc(communitiesTable.createdAt));

  const result = await Promise.all(communities.map(async (c) => {
    const [mc] = await db.select({ count: count() }).from(communityMembersTable).where(eq(communityMembersTable.communityId, c.id));
    const [pc] = await db.select({ count: count() }).from(postsTable).where(eq(postsTable.communityId, c.id));
    const [pending] = await db
      .select({ count: count() })
      .from(aiSummariesTable)
      .innerJoin(postsTable, eq(aiSummariesTable.postId, postsTable.id))
      .where(and(eq(postsTable.communityId, c.id), eq(aiSummariesTable.status, "pending")));
    return { ...c, memberCount: Number(mc?.count ?? 0), postCount: Number(pc?.count ?? 0), pendingValidations: Number(pending?.count ?? 0) };
  }));

  res.json(result);
});

router.get("/medpro/ai-summaries/queue", requireMedPro, async (req, res) => {
  const status = (req.query.status as string) ?? "pending";
  const communityId = req.query.communityId ? Number(req.query.communityId) : undefined;

  let query = db
    .select({ summary: aiSummariesTable, post: postsTable, community: communitiesTable })
    .from(aiSummariesTable)
    .innerJoin(postsTable, eq(aiSummariesTable.postId, postsTable.id))
    .innerJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
    .$dynamic();

  const conditions = [eq(aiSummariesTable.status, status as "pending" | "approved" | "rejected" | "edited")];
  if (communityId) conditions.push(eq(postsTable.communityId, communityId));

  const results = await query.where(and(...conditions)).orderBy(desc(aiSummariesTable.createdAt)).limit(50);

  res.json(results.map(({ summary, post, community }) => ({
    id: summary.id,
    postId: summary.postId,
    postTitle: post.title,
    postContent: post.content,
    communityName: community.name,
    communitySlug: community.slug,
    whatItCouldBe: summary.whatItCouldBe,
    riskLevel: summary.riskLevel,
    whatToDo: summary.whatToDo,
    whenToSeeDoctor: summary.whenToSeeDoctor,
    disclaimer: summary.disclaimer,
    status: summary.status,
    editedContent: summary.editedContent,
    validationNote: summary.validationNote,
    validatedAt: summary.validatedAt,
    createdAt: summary.createdAt,
  })));
});

router.patch("/medpro/ai-summaries/:id/validate", requireMedPro, async (req, res) => {
  const summaryId = Number(req.params.id);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const { action, editedContent, validationNote } = req.body;

  if (!["approve", "reject", "edit"].includes(action)) {
    res.status(400).json({ error: "action must be approve | reject | edit" });
    return;
  }

  const statusMap: Record<string, "approved" | "rejected" | "edited"> = {
    approve: "approved",
    reject: "rejected",
    edit: "edited",
  };

  const [updated] = await db.update(aiSummariesTable).set({
    status: statusMap[action],
    validatedById: user.id,
    validatedAt: new Date(),
    editedContent: editedContent ?? null,
    validationNote: validationNote ?? null,
  }).where(eq(aiSummariesTable.id, summaryId)).returning();

  if (!updated) { res.status(404).json({ error: "AI Summary not found" }); return; }

  if (action === "approve" || action === "edit") {
    await db.update(postsTable).set({ isExpertAnswered: true }).where(eq(postsTable.id, updated.postId));
  }

  res.json({ success: true, summary: updated });
});

router.post("/medpro/communities/:id/expert-response", requireMedPro, async (req, res) => {
  const communityId = Number(req.params.id);
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const user = await getOrCreateUser(clerkId);
  const { postId, content } = req.body;
  if (!postId || !content) { res.status(400).json({ error: "postId and content required" }); return; }

  const [comment] = await db.insert(commentsTable).values({
    postId,
    authorId: user.id,
    content: `[EXPERT RESPONSE] ${content}`,
  }).returning();

  await db.update(postsTable).set({ isExpertAnswered: true, commentCount: 1 }).where(eq(postsTable.id, postId));

  res.status(201).json(comment);
});

router.get("/medpro/stats", requireMedPro, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const [myValidations] = await db.select({ count: count() }).from(aiSummariesTable).where(eq(aiSummariesTable.validatedById, user.id));
  const [pendingTotal] = await db.select({ count: count() }).from(aiSummariesTable).where(eq(aiSummariesTable.status, "pending"));
  const [approvedTotal] = await db.select({ count: count() }).from(aiSummariesTable).where(eq(aiSummariesTable.status, "approved"));
  const [rejectedTotal] = await db.select({ count: count() }).from(aiSummariesTable).where(eq(aiSummariesTable.status, "rejected"));

  res.json({
    myValidations: Number(myValidations?.count ?? 0),
    pendingTotal: Number(pendingTotal?.count ?? 0),
    approvedTotal: Number(approvedTotal?.count ?? 0),
    rejectedTotal: Number(rejectedTotal?.count ?? 0),
    isVerifiedPro: user.isVerifiedPro,
    specialty: user.specialty,
  });
});

router.get("/medpro/urgent-cases", requireMedPro, async (req, res) => {
  const urgentSummaries = await db
    .select({ summary: aiSummariesTable, post: postsTable, community: communitiesTable })
    .from(aiSummariesTable)
    .innerJoin(postsTable, eq(aiSummariesTable.postId, postsTable.id))
    .innerJoin(communitiesTable, eq(postsTable.communityId, communitiesTable.id))
    .where(and(
      eq(aiSummariesTable.status, "pending"),
      inArray(aiSummariesTable.riskLevel, ["high", "emergency"])
    ))
    .orderBy(desc(aiSummariesTable.createdAt))
    .limit(50);

  res.json(urgentSummaries.map(({ summary, post, community }) => ({
    id: summary.id,
    postId: summary.postId,
    postTitle: post.title,
    postContent: post.content,
    communityName: community.name,
    communitySlug: community.slug,
    whatItCouldBe: summary.whatItCouldBe,
    riskLevel: summary.riskLevel,
    whatToDo: summary.whatToDo,
    whenToSeeDoctor: summary.whenToSeeDoctor,
    disclaimer: summary.disclaimer,
    status: summary.status,
    createdAt: summary.createdAt,
  })));
});

router.get("/medpro/consultations", requireMedPro, async (req, res) => {
  const status = (req.query.status as string) || "pending";

  const consultations = await db
    .select({
      consultation: doctorConsultationsTable,
      user: usersTable,
      post: postsTable,
    })
    .from(doctorConsultationsTable)
    .innerJoin(usersTable, eq(doctorConsultationsTable.userId, usersTable.id))
    .leftJoin(postsTable, eq(doctorConsultationsTable.postId, postsTable.id))
    .where(eq(doctorConsultationsTable.status, status as "pending" | "in_review" | "resolved"))
    .orderBy(desc(doctorConsultationsTable.createdAt))
    .limit(50);

  res.json(consultations.map(({ consultation, user, post }) => ({
    id: consultation.id,
    riskLevel: consultation.riskLevel,
    reason: consultation.reason,
    status: consultation.status,
    source: consultation.source,
    doctorNote: consultation.doctorNote,
    createdAt: consultation.createdAt,
    resolvedAt: consultation.resolvedAt,
    postId: consultation.postId,
    postTitle: post?.title ?? null,
    chatSessionId: consultation.chatSessionId,
    user: { id: user.id, displayName: user.displayName, email: user.email, avatarUrl: user.avatarUrl },
  })));
});

router.patch("/medpro/consultations/:id/resolve", requireMedPro, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const doctor = await getOrCreateUser(clerkId);
  const id = Number(req.params.id);
  const { doctorNote, status } = req.body;

  const [updated] = await db.update(doctorConsultationsTable).set({
    status: status ?? "resolved",
    doctorNote: doctorNote ?? null,
    resolvedById: doctor.id,
    resolvedAt: new Date(),
  }).where(eq(doctorConsultationsTable.id, id)).returning();

  if (!updated) { res.status(404).json({ error: "Consultation not found" }); return; }
  res.json({ success: true, consultation: updated });
});

export default router;
