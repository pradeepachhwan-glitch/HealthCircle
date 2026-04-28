import { Router } from "express";
import {
  db,
  tcConsultations,
  tcTriageSessions,
  tcPrescriptions,
  tcMessages,
  doctorsTable as doctors,
} from "@workspace/db";
import { eq, desc, and, ilike } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { aiChatJson } from "../lib/aiClient";

const router = Router();

// ─── HELPERS ───────────────────────────────────────────────────────────────

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Verifies the given consultation exists AND belongs to the current user.
 * Returns the consultation row, or null if not found / not owned.
 */
async function getOwnedConsultation(consultationId: number, userId: number) {
  const [row] = await db
    .select()
    .from(tcConsultations)
    .where(
      and(
        eq(tcConsultations.id, consultationId),
        eq(tcConsultations.userId, userId),
      ),
    );
  return row ?? null;
}

// ─── TRIAGE ────────────────────────────────────────────────────────────────

router.post("/tc/triage/start", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const { chiefComplaint, symptoms, duration, severity, medicalHistory, medications, vitals } =
    req.body;

  if (!chiefComplaint) {
    return res.status(400).json({ error: "Chief complaint is required" });
  }

  const symptomsArr = Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : [];

  interface TriageResult {
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    riskReason: string;
    summary: string;
    suggestedSpecialty: string;
    suggestedConsultType: "video" | "async";
    keyFindings: string[];
    urgencyMessage: string;
    redFlags: string[];
  }

  const parsed = await aiChatJson<TriageResult>({
    systemPrompt: `You are Yukti, an AI medical triage assistant for HealthCircle, an India-first healthcare platform.
Analyze patient-submitted symptoms and return a structured clinical triage assessment.
Always be professional, empathetic, and err on the side of caution.
Respond ONLY with the exact JSON schema requested — no prose, no markdown.`,
    userPrompt: `Patient presents with:
- Chief Complaint: ${chiefComplaint}
- Symptoms: ${symptomsArr.length ? symptomsArr.join(", ") : "Not specified"}
- Duration: ${duration ?? "Not specified"}
- Severity (1-10): ${severity ?? "Not specified"}
- Medical History: ${medicalHistory ?? "None provided"}
- Current Medications: ${medications ?? "None"}
- Vitals: ${vitals ?? "Not provided"}

Return this JSON object (no other text):
{
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "riskReason": "brief explanation",
  "summary": "2-3 sentence clinical summary for the doctor",
  "suggestedSpecialty": "specific specialty name",
  "suggestedConsultType": "video" | "async",
  "keyFindings": ["finding1", "finding2"],
  "urgencyMessage": "patient-friendly urgency message (1 sentence)",
  "redFlags": ["flag1"] or []
}
Rules: HIGH = chest pain, breathing difficulty, stroke symptoms, severe trauma; MEDIUM = persistent or worsening symptoms; LOW = mild or routine`,
    jsonMode: true,
    maxTokens: 600,
    timeoutMs: 10000,
  });

  const fallback: TriageResult = {
    riskLevel: "MEDIUM",
    riskReason: "AI triage unavailable — defaulting to standard review",
    summary: `Patient presents with: ${chiefComplaint}. Duration: ${duration ?? "unspecified"}. Severity: ${severity ?? "unspecified"}/10.`,
    suggestedSpecialty: "General Physician",
    suggestedConsultType: "video",
    keyFindings: [chiefComplaint, ...symptomsArr].filter(Boolean),
    urgencyMessage: "Please consult a doctor for proper evaluation.",
    redFlags: [],
  };

  const result = parsed ?? fallback;

  const [session] = await db
    .insert(tcTriageSessions)
    .values({
      userId,
      chiefComplaint,
      symptomsJson: JSON.stringify(symptomsArr),
      duration: duration ?? null,
      severity: severity !== undefined ? parseInt(String(severity)) : null,
      medicalHistory: medicalHistory ?? null,
      medications: medications ?? null,
      vitals: vitals ?? null,
      riskLevel: result.riskLevel,
      summary: JSON.stringify(result),
      suggestedSpecialty: result.suggestedSpecialty,
      suggestedConsultType: result.suggestedConsultType,
      rawAiResponse: JSON.stringify(result),
    })
    .returning();

  return res.json({ triageSession: session, parsed: result });
});

router.get("/tc/triage/:id", requireAuth, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const [session] = await db
    .select()
    .from(tcTriageSessions)
    .where(
      and(
        eq(tcTriageSessions.id, id),
        eq(tcTriageSessions.userId, req.user.id),
      ),
    );
  if (!session) return res.status(404).json({ error: "Not found" });
  return res.json({ triageSession: session });
});

// ─── DOCTORS ───────────────────────────────────────────────────────────────

router.get("/tc/doctors", requireAuth, async (req: any, res) => {
  const { specialty } = req.query as Record<string, string>;
  let list;
  if (specialty && specialty !== "all") {
    list = await db
      .select()
      .from(doctors)
      .where(ilike(doctors.specialty, `%${specialty}%`))
      .orderBy(desc(doctors.rating));
  } else {
    list = await db.select().from(doctors).orderBy(desc(doctors.rating));
  }
  return res.json({ doctors: list });
});

// ─── CONSULTATIONS ─────────────────────────────────────────────────────────

router.post("/tc/consultation/book", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const { doctorId, triageSessionId, type, chiefComplaint, consentGiven, scheduledAt } =
    req.body;

  // Strict boolean consent check (compliance: prevents truthy-but-not-true bypass)
  if (consentGiven !== true) {
    return res.status(400).json({ error: "Consent is required before booking" });
  }
  const doctorIdNum = parseId(doctorId);
  if (!doctorIdNum) {
    return res.status(400).json({ error: "Doctor selection is required" });
  }
  const allowedTypes = new Set(["video", "audio", "chat"]);
  const safeType = typeof type === "string" && allowedTypes.has(type) ? type : "video";

  const [doctorRow] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.id, doctorIdNum));
  if (!doctorRow) return res.status(404).json({ error: "Doctor not found" });

  // Validate triage session belongs to the requester (prevent IDOR-via-link)
  let triageIdToLink: number | null = null;
  if (triageSessionId !== undefined && triageSessionId !== null && triageSessionId !== "") {
    const tId = parseId(triageSessionId);
    if (!tId) {
      return res.status(400).json({ error: "Invalid triageSessionId" });
    }
    const [t] = await db
      .select({ id: tcTriageSessions.id })
      .from(tcTriageSessions)
      .where(
        and(eq(tcTriageSessions.id, tId), eq(tcTriageSessions.userId, userId)),
      );
    if (!t) return res.status(403).json({ error: "Triage session not yours" });
    triageIdToLink = tId;
  }

  const [consultation] = await db
    .insert(tcConsultations)
    .values({
      userId,
      doctorId: doctorIdNum,
      triageSessionId: triageIdToLink,
      type: safeType,
      status: "booked",
      chiefComplaint: chiefComplaint ?? null,
      consentGiven: "true",
      consultationFee: doctorRow.consultationFee,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    })
    .returning();

  return res.status(201).json({ consultation });
});

router.get("/tc/consultations", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const rows = await db
    .select()
    .from(tcConsultations)
    .where(eq(tcConsultations.userId, userId))
    .orderBy(desc(tcConsultations.createdAt));
  return res.json({ consultations: rows });
});

router.get("/tc/consultation/:id", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const consultation = await getOwnedConsultation(id, userId);
  if (!consultation) return res.status(404).json({ error: "Not found" });

  const [triageSession] = consultation.triageSessionId
    ? await db
        .select()
        .from(tcTriageSessions)
        .where(eq(tcTriageSessions.id, consultation.triageSessionId))
    : [null];

  const [doctorRow] = consultation.doctorId
    ? await db.select().from(doctors).where(eq(doctors.id, consultation.doctorId))
    : [null];

  const messages = await db
    .select()
    .from(tcMessages)
    .where(eq(tcMessages.consultationId, consultation.id))
    .orderBy(tcMessages.createdAt);

  const [prescription] = await db
    .select()
    .from(tcPrescriptions)
    .where(eq(tcPrescriptions.consultationId, consultation.id));

  return res.json({
    consultation,
    triageSession: triageSession ?? null,
    doctor: doctorRow ?? null,
    messages,
    prescription: prescription ?? null,
  });
});

router.post("/tc/consultation/:id/start", requireAuth, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const owned = await getOwnedConsultation(id, req.user.id);
  if (!owned) return res.status(404).json({ error: "Not found" });

  const [updated] = await db
    .update(tcConsultations)
    .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(tcConsultations.id, id))
    .returning();
  return res.json({ consultation: updated });
});

router.post("/tc/consultation/:id/close", requireAuth, async (req: any, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid id" });
  const owned = await getOwnedConsultation(id, req.user.id);
  if (!owned) return res.status(404).json({ error: "Not found" });

  const { diagnosis, notes, followUpInstructions } = req.body;
  const [updated] = await db
    .update(tcConsultations)
    .set({
      status: "completed",
      endedAt: new Date(),
      diagnosis: diagnosis ?? null,
      notes: notes ?? null,
      followUpInstructions: followUpInstructions ?? null,
      updatedAt: new Date(),
    })
    .where(eq(tcConsultations.id, id))
    .returning();
  return res.json({ consultation: updated });
});

// ─── MESSAGES ──────────────────────────────────────────────────────────────

router.post("/tc/message", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const { consultationId, message, senderRole } = req.body;
  const cId = parseId(consultationId);
  if (!cId || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "consultationId and message required" });
  }

  // Ownership check: only patient who owns the consultation may post here.
  // (Doctor-side messaging would require its own role check, not yet wired.)
  const owned = await getOwnedConsultation(cId, userId);
  if (!owned) return res.status(404).json({ error: "Consultation not found" });

  const [msg] = await db
    .insert(tcMessages)
    .values({
      consultationId: cId,
      senderId: userId,
      // senderRole is ignored from input — patient route always logs as patient.
      senderRole: "patient",
      message: message.trim(),
    })
    .returning();
  return res.status(201).json({ message: msg });
});

// ─── PRESCRIPTIONS ─────────────────────────────────────────────────────────

router.post("/tc/prescription/generate", requireAuth, async (req: any, res) => {
  const userId: number = req.user.id;
  const { consultationId, icdCodes, medications, instructions, followUpDate, redFlags } =
    req.body;
  const cId = parseId(consultationId);
  if (!cId) {
    return res.status(400).json({ error: "consultationId required" });
  }

  const owned = await getOwnedConsultation(cId, userId);
  if (!owned) return res.status(404).json({ error: "Consultation not found" });

  const [existing] = await db
    .select()
    .from(tcPrescriptions)
    .where(eq(tcPrescriptions.consultationId, cId));

  let prescription;
  if (existing) {
    [prescription] = await db
      .update(tcPrescriptions)
      .set({
        icdCodes: icdCodes ?? null,
        medicationsJson: medications ? JSON.stringify(medications) : null,
        instructions: instructions ?? null,
        followUpDate: followUpDate ?? null,
        redFlags: redFlags ? JSON.stringify(redFlags) : null,
      })
      .where(eq(tcPrescriptions.id, existing.id))
      .returning();
  } else {
    [prescription] = await db
      .insert(tcPrescriptions)
      .values({
        consultationId: cId,
        icdCodes: icdCodes ?? null,
        medicationsJson: medications ? JSON.stringify(medications) : null,
        instructions: instructions ?? null,
        followUpDate: followUpDate ?? null,
        redFlags: redFlags ? JSON.stringify(redFlags) : null,
      })
      .returning();
  }
  return res.json({ prescription });
});

router.get("/tc/prescription/:consultationId", requireAuth, async (req: any, res) => {
  const cId = parseId(req.params.consultationId);
  if (!cId) return res.status(400).json({ error: "Invalid consultationId" });

  const owned = await getOwnedConsultation(cId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Not found" });

  const [prescription] = await db
    .select()
    .from(tcPrescriptions)
    .where(eq(tcPrescriptions.consultationId, cId));
  if (!prescription) return res.status(404).json({ error: "Not found" });
  return res.json({ prescription });
});

export default router;
