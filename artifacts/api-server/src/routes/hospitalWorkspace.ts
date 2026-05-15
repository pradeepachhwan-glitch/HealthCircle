import { Router, type Request, type Response } from "express";
import { db, hospitalConsultationsTable, hospitalSettingsTable, hospitalCareTeamTable, usersTable, hospitalsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requirePartnerAccess, pstr } from "../lib/auth";
import { logger } from "../lib/logger";
import { aiChatJson } from "../lib/aiClient";
import { z } from "zod/v4";
import { createMeetEvent, getAuthUrl } from "../lib/googleCalendar";

const router = Router();

// All routes in this file require either a Medical Professional role OR a Hospital accountType.
router.use(requirePartnerAccess);

/**
 * Helper to resolve hospitalId for the current user session.
 * Supports both direct 'hospital' accounts and 'medical_professional' staff.
 */
async function getHospitalId(req: Request): Promise<number | null> {
  const userId = req.user!.id;
  
  if (req.user?.accountType === "hospital") {
     const [h] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.email, req.user.email)).limit(1);
     return h?.id || null;
  } 
  
  if (req.user?.role === "medical_professional" || req.user?.role === "admin") {
     const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, userId)).limit(1);
     return ct?.hospitalId || null;
  }

  return null;
}

// ---- 1. GOOGLE OAUTH HANDSHAKE ----
router.post("/hospital/google/authorize", async (req: Request, res: Response) => {
  try {
    const authUrl = await getAuthUrl(req.user!.id);
    if (!authUrl) {
      res.status(400).json({ error: "Google OAuth configuration missing on server" });
      return;
    }
    res.json({ success: true, url: authUrl });
  } catch (err) {
    logger.error({ err }, "Google authorize failed");
    res.status(500).json({ error: "Internal server error" });
  }
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

    const hospitalId = await getHospitalId(req);
    if (!hospitalId) {
      res.status(403).json({ error: "User is not associated with a hospital workspace" });
      return;
    }

    const userId = req.user!.id;
    const doctorId = parsed.data.doctorId || userId;
    const [patient] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.patientId)).limit(1);

    if (!patient) {
      res.status(404).json({ error: "Patient not found" });
      return;
    }

    // Attempt to generate Google Meet link if scheduled
    let googleMeetUrl: string | null = null;
    let googleEventId: string | null = null;

    if (parsed.data.scheduledAt) {
      try {
        const meet = await createMeetEvent(userId, {
          summary: `HealthCircle Consult: ${patient.displayName || 'Patient'}`,
          description: `Teleconsultation scheduled via Hospital Workspace.\nChief Complaint: ${parsed.data.chiefComplaint || 'General'}\nPatient: ${patient.displayName || 'Unknown'}`,
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
  const id = parseInt(pstr(req.params.id));
  
  try {
    const hospitalId = await getHospitalId(req);
    const [consult] = await db.select()
      .from(hospitalConsultationsTable)
      .where(and(eq(hospitalConsultationsTable.id, id), eq(hospitalConsultationsTable.hospitalId, hospitalId!)))
      .limit(1);

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
      systemPrompt: "You are a professional medical scribe. Generate a structured SOAP note based on the provided clinical notes and patient complaint. Ensure professional tone. Output ONLY the JSON with subjective, objective, assessment, and plan keys.",
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
      .where(eq(hospitalConsultationsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Scribe failed");
    res.status(500).json({ error: "Scribe failed" });
  }
});

// ---- 4. DOCTOR APPROVAL & SIGNATURE ----
router.patch("/hospital/consultations/:id/approve", async (req: Request, res: Response) => {
  const id = parseInt(pstr(req.params.id));

  try {
    const hospitalId = await getHospitalId(req);
    const [consult] = await db.select()
      .from(hospitalConsultationsTable)
      .where(and(eq(hospitalConsultationsTable.id, id), eq(hospitalConsultationsTable.hospitalId, hospitalId!)))
      .limit(1);

    if (!consult) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    // Fetch doctor's signature info
    const [ct] = await db.select().from(hospitalCareTeamTable).where(eq(hospitalCareTeamTable.userId, req.user!.id)).limit(1);
    const signatureBlock = ct ? `${ct.credentials || "Doctor"} - Reg No: ${ct.registrationNumber || "N/A"}` : "Doctor Signature";

    const [updated] = await db.update(hospitalConsultationsTable)
      .set({ 
        isApproved: true, 
        approvedAt: new Date(),
        status: "completed",
        signatureBlockUsed: signatureBlock,
        updatedAt: new Date() 
      })
      .where(eq(hospitalConsultationsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Approval failed");
    res.status(500).json({ error: "Approval failed" });
  }
});

// ---- 5. GET CONSULTATION DATA FOR PDF/PRINT ----
router.get("/hospital/consultations/:id/pdf-data", async (req: Request, res: Response) => {
  const id = parseInt(pstr(req.params.id));

  try {
    const hospitalId = await getHospitalId(req);
    const [consult] = await db.select({
      consultation: hospitalConsultationsTable,
      patient: {
        displayName: usersTable.displayName,
        email: usersTable.email,
      },
      hospital: hospitalsTable,
      settings: hospitalSettingsTable,
    })
    .from(hospitalConsultationsTable)
    .innerJoin(usersTable, eq(hospitalConsultationsTable.patientId, usersTable.id))
    .innerJoin(hospitalsTable, eq(hospitalConsultationsTable.hospitalId, hospitalsTable.id))
    .leftJoin(hospitalSettingsTable, eq(hospitalConsultationsTable.hospitalId, hospitalSettingsTable.hospitalId))
    .where(and(eq(hospitalConsultationsTable.id, id), eq(hospitalConsultationsTable.hospitalId, hospitalId!)))
    .limit(1);

    if (!consult) {
      res.status(404).json({ error: "Consultation not found" });
      return;
    }

    res.json(consult);
  } catch (err) {
    logger.error({ err }, "Failed to fetch PDF data");
    res.status(500).json({ error: "Failed to fetch consultation data" });
  }
});

// ---- EXTRA: LIST CONSULTATIONS (The Inbox Feed) ----
router.get("/hospital/consultations", async (req: Request, res: Response) => {
  try {
    const hospitalId = await getHospitalId(req);
    if (!hospitalId) {
      res.status(403).json({ error: "User is not associated with a hospital workspace" });
      return;
    }

    const consultations = await db.select({
      id: hospitalConsultationsTable.id,
      status: hospitalConsultationsTable.status,
      scheduledAt: hospitalConsultationsTable.scheduledAt,
      chiefComplaint: hospitalConsultationsTable.intakeSummary,
      googleMeetUrl: hospitalConsultationsTable.googleMeetUrl,
      isApproved: hospitalConsultationsTable.isApproved,
      createdAt: hospitalConsultationsTable.createdAt,
      patientName: usersTable.displayName,
      patientAvatar: usersTable.avatarUrl,
    })
    .from(hospitalConsultationsTable)
    .innerJoin(usersTable, eq(hospitalConsultationsTable.patientId, usersTable.id))
    .where(eq(hospitalConsultationsTable.hospitalId, hospitalId))
    .orderBy(desc(hospitalConsultationsTable.createdAt));

    res.json(consultations);
  } catch (err) {
    logger.error({ err }, "Failed to list consultations");
    res.status(500).json({ error: "Failed to fetch consultations" });
  }
});

// ---- 6. CARE TEAM MANAGEMENT ----
const addTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["doctor", "nurse", "admin", "front_desk"]),
});

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

router.get("/hospital/care-team", async (req: Request, res: Response) => {
  try {
    const hospitalId = await getHospitalId(req);
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

router.post("/hospital/care-team", async (req: Request, res: Response) => {
  try {
    const parsed = addTeamMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid member data", details: parsed.error });
      return;
    }

    const hospitalId = await getHospitalId(req);
    if (!hospitalId) {
      res.status(403).json({ error: "Hospital not found" });
      return;
    }

    // Security check: Only admins or the hospital account itself can add
    if (req.user?.accountType !== "hospital") {
       const [ct] = await db.select().from(hospitalCareTeamTable).where(and(eq(hospitalCareTeamTable.userId, req.user!.id), eq(hospitalCareTeamTable.hospitalId, hospitalId))).limit(1);
       if (ct?.role !== "admin") {
         res.status(403).json({ error: "Only admins can add team members" });
         return;
       }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found with this email. They must join HealthCircle first." });
      return;
    }

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
    const hospitalId = await getHospitalId(req);
    if (!hospitalId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    // Security check: Only admins or the hospital account itself can remove
    if (req.user?.accountType !== "hospital") {
       const [ct] = await db.select().from(hospitalCareTeamTable).where(and(eq(hospitalCareTeamTable.userId, req.user!.id), eq(hospitalCareTeamTable.hospitalId, hospitalId))).limit(1);
       if (ct?.role !== "admin") {
         res.status(403).json({ error: "Only admins can remove team members" });
         return;
       }
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

// ---- 7. BRANDING & SETTINGS ----
const updateSettingsSchema = z.object({
  logoUrl: z.string().optional(),
  letterheadConfig: z.record(z.any()).optional(),
  signatureBlockTemplate: z.string().optional(),
});

router.get("/hospital/settings", async (req: Request, res: Response) => {
  try {
    const hospitalId = await getHospitalId(req);
    const [settings] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, hospitalId!)).limit(1);
    const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, hospitalId!)).limit(1);
    
    res.json({
      hospital,
      settings: settings || null
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.patch("/hospital/settings", async (req: Request, res: Response) => {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid settings data", details: parsed.error });
      return;
    }

    const hospitalId = await getHospitalId(req);
    const [existing] = await db.select().from(hospitalSettingsTable).where(eq(hospitalSettingsTable.hospitalId, hospitalId!)).limit(1);

    if (existing) {
      const [updated] = await db.update(hospitalSettingsTable)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(hospitalSettingsTable.hospitalId, hospitalId!))
        .returning();
      res.json(updated);
    } else {
      const [created] = await db.insert(hospitalSettingsTable).values({
        hospitalId: hospitalId!,
        ...parsed.data,
      }).returning();
      res.json(created);
    }
  } catch (err) {
    logger.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- 8. OPERATIONAL STATS ----
router.get("/hospital/stats", async (req: Request, res: Response) => {
  try {
    const hospitalId = await getHospitalId(req);
    if (!hospitalId) {
      res.status(403).json({ error: "Unauthorized" });
      return;
    }

    const [consultationsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(hospitalConsultationsTable)
      .where(eq(hospitalConsultationsTable.hospitalId, hospitalId));

    const [teamCount] = await db.select({ count: sql<number>`count(*)` })
      .from(hospitalCareTeamTable)
      .where(eq(hospitalCareTeamTable.hospitalId, hospitalId));

    const [completedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(hospitalConsultationsTable)
      .where(and(eq(hospitalConsultationsTable.hospitalId, hospitalId), eq(hospitalConsultationsTable.status, "completed")));

    res.json({
      totalAppointments: Number(consultationsCount?.count || 0),
      activeDoctors: Number(teamCount?.count || 0),
      completionRate: consultationsCount?.count ? Math.round((Number(completedCount?.count || 0) / Number(consultationsCount.count)) * 100) : 0,
      revenue: "₹" + (Number(completedCount?.count || 0) * 500).toLocaleString(), 
      trends: {
        appointments: "up",
        growth: "up",
        completion: "up"
      }
    });
  } catch (err) {
    logger.error({ err }, "Failed to fetch hospital stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
