import { Router, type Request, type Response } from "express";
import { db, hospitalConsultationsTable, hospitalSettingsTable, hospitalCareTeamTable, usersTable, hospitalsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requirePartnerAccess, pstr } from "../lib/auth";
import { logger } from "../lib/logger";
import { aiChatJson } from "../lib/aiClient";
import { z } from "zod/v4";
import { createMeetEvent } from "../lib/googleCalendar";

const router = Router();

// All routes in this file require either a Medical Professional role OR a Hospital accountType.
router.use(requirePartnerAccess);

// ---- 1. GOOGLE OAUTH HANDSHAKE (Placeholder for now) ----
router.post("/hospital/google/authorize", async (req: Request, res: Response) => {
  // Logic to initiate or complete Google OAuth for the hospital workspace
  res.json({ success: true, message: "Google authorization flow initiated" });
});

// ---- 2. CREATE/SCHEDULE CONSULTATION ----
const createConsultSchema = z.object({
  patientId: z.number(),
  doctorId: z.number().optional(),
  scheduledAt: z.string().optional(), // ISO string
  chiefComplaint: z.string().optional(),
});

router.post("/hospital/consultations", async (req: Request, res: Response) => {
  try {
    const parsed = createConsultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid consultation data", details: parsed.error });
      return;
    }

    let hospitalId: number | undefined;
    const userId = req.user!.id;
    
    if (req.user?.accountType === "hospital") {
       const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.email, req.user.email)).limit(1);
       hospitalId = h?.id;
    } else if (req.user?.role === "medical_professional" || req.user?.role === "admin") {
       const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, userId)).limit(1);
       hospitalId = ct?.hospitalId;
    }

    if (!hospitalId) {
      res.status(403).json({ error: "User is not associated with a hospital workspace" });
      return;
    }

    const doctorId = parsed.data.doctorId || userId;
    const [patient] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.patientId)).limit(1);

    // Attempt to generate Google Meet link if scheduled
    let googleMeetUrl: string | null = null;
    let googleEventId: string | null = null;

    if (parsed.data.scheduledAt) {
      try {
        const meet = await createMeetEvent(userId, {
          summary: `HealthCircle Consult: Patient #${parsed.data.patientId}`,
          description: `Teleconsultation scheduled via Hospital Workspace.\nChief Complaint: ${parsed.data.chiefComplaint || 'General'}\nPatient: ${patient?.displayName || 'Unknown'}`,
          startTime: new Date(parsed.data.scheduledAt),
          durationMinutes: 30,
        });
        if (meet) {
          googleMeetUrl = meet.meetUrl || null;
          googleEventId = meet.eventId || null;
        }
      } catch (err) {
        logger.warn({ err, userId }, "Google Meet generation failed (non-fatal)");
      }
    }

    const [consultation] = await db.insert(hospitalConsultationsTable).values({
      hospitalId,
      patientId: parsed.data.patientId,
      doctorId,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      status: parsed.data.scheduledAt ? "scheduled" : "requested",
      googleMeetUrl,
      googleEventId,
      intakeSummary: parsed.data.chiefComplaint,
    }).returning();

    res.status(201).json(consultation);
  } catch (err) {
    logger.error({ err }, "Failed to create consultation");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- 3. AI SOAP SCRIBE ----
router.post("/hospital/consultations/:id/scribe", async (req: Request, res: Response) => {
  const id = pstr(req.params.id);
  const consultId = parseInt(id);
  
  try {
    const [consult] = await db.select().from(hospitalConsultationsTable).where(eq(hospitalConsultationsTable.id, consultId)).limit(1);
    if (!consult) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    interface SOAP {
      subjective: string;
      objective: string;
      assessment: string;
      plan: string;
    }

    const soap = await aiChatJson<SOAP>({
      systemPrompt: "You are a professional medical scribe. Generate a structured SOAP note based on the provided clinical notes and patient complaint. Subjective: Patient symptoms and history. Objective: Vital signs and observations. Assessment: Differential diagnosis and clinical reasoning. Plan: Medications, labs, and follow-up.",
      userPrompt: `Chief Complaint: ${consult.intakeSummary || "Not specified"}
Clinical Notes: ${consult.notes || "No session notes provided."}
Vitals: ${consult.vitalsJson ? JSON.stringify(consult.vitalsJson) : "Not recorded"}`,
    });
    
    const finalSoap = soap || {
      subjective: "Patient reports: " + (consult.intakeSummary || "N/A"),
      objective: "Physical exam pending or not recorded.",
      assessment: "Clinical review required.",
      plan: "Follow-up as per doctor instructions."
    };

    const [updated] = await db.update(hospitalConsultationsTable)
      .set({ soapDraft: finalSoap, updatedAt: new Date() })
      .where(eq(hospitalConsultationsTable.id, consultId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Scribe failed");
    res.status(500).json({ error: "Scribe failed" });
  }
});

// ---- 4. DOCTOR APPROVAL & SIGNATURE ----
router.patch("/hospital/consultations/:id/approve", async (req: Request, res: Response) => {
  const id = pstr(req.params.id);
  const consultId = parseInt(id);

  try {
    const [consult] = await db.select().from(hospitalConsultationsTable).where(eq(hospitalConsultationsTable.id, consultId)).limit(1);
    if (!consult) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    // Fetch doctor's signature info
    const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, consult.doctorId!)).limit(1);
    const signatureBlock = ct ? `${ct.credentials} - Reg No: ${ct.registrationNumber}` : "Doctor Signature";

    const [updated] = await db.update(hospitalConsultationsTable)
      .set({ 
        isApproved: true, 
        approvedAt: new Date(),
        status: "completed",
        signatureBlockUsed: signatureBlock,
        updatedAt: new Date() 
      })
      .where(eq(hospitalConsultationsTable.id, consultId))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Approval failed");
    res.status(500).json({ error: "Approval failed" });
  }
});

// ---- 5. GENERATE PDF NOTE ----
router.get("/hospital/consultations/:id/pdf", async (req: Request, res: Response) => {
  // This will eventually stream a PDF. For now, it returns the data that would be in the PDF.
  const id = pstr(req.params.id);
  const consultId = parseInt(id);

  try {
    const [consult] = await db.select().from(hospitalConsultationsTable).where(eq(hospitalConsultationsTable.id, consultId)).limit(1);
    if (!consult || !consult.isApproved) {
      res.status(400).json({ error: "Consultation not found or not yet approved" });
      return;
    }

    // Mock PDF metadata response
    res.json({
      title: "Clinical Consultation Note",
      hospitalId: consult.hospitalId,
      date: consult.approvedAt,
      soap: consult.soapDraft,
      signature: consult.signatureBlockUsed,
      message: "PDF Generation Logic Incoming"
    });
  } catch (err) {
    logger.error({ err }, "PDF generation metadata fetch failed");
    res.status(500).json({ error: "Failed to fetch PDF data" });
  }
});

// ---- EXTRA: LIST CONSULTATIONS (The Inbox Feed) ----
router.get("/hospital/consultations", async (req: Request, res: Response) => {
  try {
    // Basic multi-tenant filtering (simplified)
    const consultations = await db.select().from(hospitalConsultationsTable).orderBy(desc(hospitalConsultationsTable.createdAt));
    res.json(consultations);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch consultations" });
  }
});

// ---- 6. CARE TEAM MANAGEMENT ----
const updateProfileSchema = z.object({
  specialty: z.string().optional(),
  credentials: z.string().optional(),
  registrationNumber: z.string().optional(),
  signatureUrl: z.string().optional(),
});

router.get("/hospital/profile/me", async (req: Request, res: Response) => {
  try {
    const [profile] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, req.user!.id)).limit(1);
    res.json(profile || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/hospital/profile/me", async (req: Request, res: Response) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid profile data", details: parsed.error });
      return;
    }

    const [existing] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, req.user!.id)).limit(1);

    if (existing) {
      const [updated] = await db.update(hospitalCareTeamTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(hospitalCareTeamTable.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      res.status(404).json({ error: "Care team profile not found. Please contact your hospital admin." });
    }
  } catch (err) {
    logger.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin endpoint: List all care team members
router.get("/hospital/care-team", async (req: Request, res: Response) => {
  try {
    let hospitalId: number | undefined;
    const userId = req.user!.id;
    
    if (req.user?.accountType === "hospital") {
       const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.email, req.user.email)).limit(1);
       hospitalId = h?.id;
    } else if (req.user?.role === "medical_professional" || req.user?.role === "admin") {
       const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, userId)).limit(1);
       hospitalId = ct?.hospitalId;
    }

    if (!hospitalId) {
      res.status(403).json({ error: "User is not associated with a hospital workspace" });
      return;
    }

    const team = await db.select({
      id: hospitalCareTeamTable.id,
      role: hospitalCareTeamTable.role,
      specialty: hospitalCareTeamTable.specialty,
      credentials: hospitalCareTeamTable.credentials,
      registrationNumber: hospitalCareTeamTable.registrationNumber,
      isPrimary: hospitalCareTeamTable.isPrimary,
      user: {
        id: usersTable.id,
        displayName: usersTable.displayName,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
      }
    })
    .from(hospitalCareTeamTable)
    .innerJoin(usersTable, eq(hospitalCareTeamTable.userId, usersTable.id))
    .where(eq(hospitalCareTeamTable.hospitalId, hospitalId));

    res.json(team);
  } catch (err) {
    logger.error({ err }, "Failed to list care team");
    res.status(500).json({ error: "Failed to list care team" });
  }
});

// Admin endpoint: Add/Invite member
const addTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["doctor", "nurse", "admin", "front_desk"]),
});

router.post("/hospital/care-team", async (req: Request, res: Response) => {
  try {
    const parsed = addTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid member data", details: parsed.error });
      return;
    }

    // Find hospitalId
    let hospitalId: number | undefined;
    if (req.user?.accountType === "hospital") {
       const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.email, req.user.email)).limit(1);
       hospitalId = h?.id;
    } else {
       const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, req.user!.id)).limit(1);
       if (ct?.role !== "admin") {
         res.status(403).json({ error: "Only admins can add team members" });
         return;
       }
       hospitalId = ct.hospitalId;
    }

    if (!hospitalId) {
      res.status(403).json({ error: "Hospital not found" });
      return;
    }

    // Find user by email
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found with this email. They must join HealthCircle first." });
      return;
    }

    // Check if already in team
    const [existing] = await db.select().from(hospitalCareTeamTable)
      .where(and(eq(hospitalCareTeamTable.hospitalId, hospitalId), eq(hospitalCareTeamTable.userId, user.id)))
      .limit(1);
    
    if (existing) {
      res.status(400).json({ error: "User is already a member of this care team" });
      return;
    }

    const [member] = await db.insert(hospitalCareTeamTable).values({
      hospitalId,
      userId: user.id,
      role: parsed.data.role,
    }).returning();

    res.status(201).json(member);
  } catch (err) {
    logger.error({ err }, "Failed to add team member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/hospital/care-team/:id", async (req: Request, res: Response) => {
  const id = parseInt(pstr(req.params.id));
  try {
    // Only hospital account or care team admin can delete
    let hospitalId: number | undefined;
    if (req.user?.accountType === "hospital") {
       const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.email, req.user.email)).limit(1);
       hospitalId = h?.id;
    } else {
       const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, req.user!.id)).limit(1);
       if (ct?.role !== "admin") {
         res.status(403).json({ error: "Only admins can remove team members" });
         return;
       }
       hospitalId = ct.hospitalId;
    }

    const [member] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.id, id)).limit(1);
    if (!member || member.hospitalId !== hospitalId) {
      res.status(404).json({ error: "Member not found in your hospital" });
      return;
    }

    await db.delete(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

export default router;
