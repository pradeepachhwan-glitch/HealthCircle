import { Router } from "express";
import {
  db,
  doctorApplicationsTable,
  doctorsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth, requireAdmin } from "../lib/auth";
import { recordAudit } from "../lib/audit";

const router = Router();

const ApplicationInput = z.object({
  name: z.string().trim().min(2).max(120),
  specialty: z.string().trim().min(2).max(120),
  registrationNumber: z.string().trim().min(2).max(80),
  experienceYears: z.coerce.number().int().min(0).max(80).default(0),
  location: z.string().trim().max(160).default(""),
  languages: z.array(z.string().trim().min(1).max(40)).max(20).default(["en"]),
  bio: z.string().trim().max(2000).optional(),
  consultationFee: z.coerce.number().min(0).max(1_000_000).default(0),
});

// ─── User-facing endpoints ────────────────────────────────────────────────

/**
 * Create or update the current user's pending doctor application.
 * If a pending application exists, it's replaced. If an approved/rejected
 * one exists, a new pending one is created (re-application).
 */
router.post("/doctor-applications", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const parsed = ApplicationInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid application", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;

  // If user is already an approved doctor, no need to re-apply.
  if (req.user.role === "medical_professional" || req.user.role === "admin") {
    res.status(409).json({ error: "You already have professional access" });
    return;
  }

  // Find pending application to update; otherwise insert new.
  const [existing] = await db
    .select()
    .from(doctorApplicationsTable)
    .where(and(eq(doctorApplicationsTable.userId, userId), eq(doctorApplicationsTable.status, "pending")))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(doctorApplicationsTable)
      .set({
        name: data.name,
        specialty: data.specialty,
        registrationNumber: data.registrationNumber,
        experienceYears: data.experienceYears,
        location: data.location,
        languages: data.languages,
        bio: data.bio ?? null,
        consultationFee: String(data.consultationFee),
      })
      .where(eq(doctorApplicationsTable.id, existing.id))
      .returning();
    await recordAudit(req, "doctor_application.update", { type: "doctor_application", id: updated.id }, null);
    res.json({ application: updated });
    return;
  }

  const [created] = await db
    .insert(doctorApplicationsTable)
    .values({
      userId,
      name: data.name,
      specialty: data.specialty,
      registrationNumber: data.registrationNumber,
      experienceYears: data.experienceYears,
      location: data.location,
      languages: data.languages,
      bio: data.bio ?? null,
      consultationFee: String(data.consultationFee),
    })
    .returning();
  await recordAudit(req, "doctor_application.create", { type: "doctor_application", id: created.id }, null);
  res.status(201).json({ application: created });
});

/** Get the current user's most recent application (any status). */
router.get("/doctor-applications/me", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const [app] = await db
    .select()
    .from(doctorApplicationsTable)
    .where(eq(doctorApplicationsTable.userId, userId))
    .orderBy(desc(doctorApplicationsTable.createdAt))
    .limit(1);
  res.json({ application: app ?? null });
});

// ─── Admin endpoints ──────────────────────────────────────────────────────

/** List applications, optionally filtered by status. */
router.get("/admin/doctor-applications", requireAdmin, async (req: any, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const where = status && ["pending", "approved", "rejected"].includes(status)
    ? eq(doctorApplicationsTable.status, status as any)
    : undefined;

  const rows = await db
    .select({
      app: doctorApplicationsTable,
      user: {
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        role: usersTable.role,
      },
    })
    .from(doctorApplicationsTable)
    .leftJoin(usersTable, eq(usersTable.id, doctorApplicationsTable.userId))
    .where(where as any)
    .orderBy(desc(doctorApplicationsTable.createdAt))
    .limit(200);

  res.json({ applications: rows });
});

const ReviewInput = z.object({
  notes: z.string().trim().max(1000).optional(),
});

/** Approve: flips user role + verifies pro + creates a doctors row + audits. */
router.post("/admin/doctor-applications/:id/approve", requireAdmin, async (req: any, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ReviewInput.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Invalid notes" }); return; }
  const reviewerId: number = req.user.id;

  // Atomic approval: promote user → ensure doctors row → mark application approved.
  // If any step fails the entire promotion is rolled back, so we never end up
  // with a "medical_professional" user without a doctors row, or vice-versa.
  let updated;
  let doctorId: number | undefined;
  let applicantUserId: number | undefined;
  try {
    const result = await db.transaction(async (tx) => {
      const [app] = await tx
        .select()
        .from(doctorApplicationsTable)
        .where(eq(doctorApplicationsTable.id, id))
        .for("update")
        .limit(1);
      if (!app) throw new Error("NOT_FOUND");
      if (app.status !== "pending") throw new Error(`ALREADY_${app.status.toUpperCase()}`);

      // 1. promote the user
      await tx
        .update(usersTable)
        .set({
          role: "medical_professional",
          isVerifiedPro: true,
          specialty: app.specialty,
          registrationNumber: app.registrationNumber,
        })
        .where(eq(usersTable.id, app.userId));

      // 2. create a doctors row if one doesn't already exist for this user
      const [existingDoctor] = await tx
        .select({ id: doctorsTable.id })
        .from(doctorsTable)
        .where(eq(doctorsTable.userId, app.userId))
        .limit(1);

      let docId = existingDoctor?.id;
      if (!docId) {
        const [doc] = await tx
          .insert(doctorsTable)
          .values({
            userId: app.userId,
            name: app.name,
            specialty: app.specialty,
            experienceYears: app.experienceYears,
            consultationFee: app.consultationFee,
            location: app.location,
            languages: app.languages,
            bio: app.bio,
            available: true,
          })
          .returning({ id: doctorsTable.id });
        docId = doc.id;
      }

      // 3. mark application approved
      const [up] = await tx
        .update(doctorApplicationsTable)
        .set({
          status: "approved",
          reviewerUserId: reviewerId,
          reviewerNotes: parsed.data.notes ?? null,
          decidedAt: new Date(),
        })
        .where(eq(doctorApplicationsTable.id, id))
        .returning();

      return { updated: up, doctorId: docId, applicantUserId: app.userId };
    });
    updated = result.updated;
    doctorId = result.doctorId;
    applicantUserId = result.applicantUserId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") { res.status(404).json({ error: "Application not found" }); return; }
    if (msg.startsWith("ALREADY_")) {
      res.status(409).json({ error: `Application is already ${msg.slice(8).toLowerCase()}` });
      return;
    }
    req.log?.error({ err }, "doctor_application.approve transaction failed");
    res.status(500).json({ error: "Approval failed" });
    return;
  }

  // Audit AFTER the transaction commits, so the audit only fires when the
  // promotion is actually durable. Best-effort, never throws.
  await recordAudit(
    req,
    "doctor_application.approve",
    { type: "doctor_application", id },
    { applicantUserId, doctorId },
  );

  res.json({ application: updated, doctorId });
});

/** Reject: status=rejected with notes + audit. User keeps current role. */
router.post("/admin/doctor-applications/:id/reject", requireAdmin, async (req: any, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ReviewInput.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: "Invalid notes" }); return; }
  const reviewerId: number = req.user.id;

  const [app] = await db.select().from(doctorApplicationsTable).where(eq(doctorApplicationsTable.id, id)).limit(1);
  if (!app) { res.status(404).json({ error: "Application not found" }); return; }
  if (app.status !== "pending") { res.status(409).json({ error: `Application is already ${app.status}` }); return; }

  const [updated] = await db
    .update(doctorApplicationsTable)
    .set({
      status: "rejected",
      reviewerUserId: reviewerId,
      reviewerNotes: parsed.data.notes ?? null,
      decidedAt: new Date(),
    })
    .where(eq(doctorApplicationsTable.id, id))
    .returning();

  await recordAudit(
    req,
    "doctor_application.reject",
    { type: "doctor_application", id },
    { applicantUserId: app.userId, notes: parsed.data.notes ?? null },
  );

  res.json({ application: updated });
});

/** Stats for admin dashboard. */
router.get("/admin/doctor-applications/stats", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      status: doctorApplicationsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(doctorApplicationsTable)
    .groupBy(doctorApplicationsTable.status);
  const stats: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) stats[r.status] = Number(r.count);
  res.json({ stats });
});

export default router;
