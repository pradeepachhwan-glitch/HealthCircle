import { Router } from "express";
import { getAuth } from "../lib/auth";
import { db } from "@workspace/db";
import { appointmentsTable, doctorsTable, hospitalsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireAdmin, getOrCreateUser } from "../lib/auth";

const router = Router();

router.get("/appointments", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const appointments = await db
    .select({
      id: appointmentsTable.id,
      appointmentTime: appointmentsTable.appointmentTime,
      status: appointmentsTable.status,
      notes: appointmentsTable.notes,
      createdAt: appointmentsTable.createdAt,
      doctor: {
        id: doctorsTable.id,
        name: doctorsTable.name,
        specialty: doctorsTable.specialty,
        imageUrl: doctorsTable.imageUrl,
      },
      hospital: {
        id: hospitalsTable.id,
        name: hospitalsTable.name,
        location: hospitalsTable.location,
      },
    })
    .from(appointmentsTable)
    .leftJoin(doctorsTable, eq(appointmentsTable.doctorId, doctorsTable.id))
    .leftJoin(hospitalsTable, eq(appointmentsTable.hospitalId, hospitalsTable.id))
    .where(eq(appointmentsTable.patientId, user.id))
    .orderBy(desc(appointmentsTable.appointmentTime));

  res.json(appointments);
});

router.post("/appointments", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const { doctorId, hospitalId, appointmentTime, notes } = req.body;
  if (!appointmentTime) {
    res.status(400).json({ error: "Appointment time is required" }); return;
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      patientId: user.id,
      doctorId: doctorId ?? null,
      hospitalId: hospitalId ?? null,
      appointmentTime: new Date(appointmentTime),
      notes: notes ?? null,
    })
    .returning();

  res.status(201).json(appointment);
});

router.patch("/appointments/:appointmentId/cancel", requireAuth, async (req, res) => {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const user = await getOrCreateUser(clerkId);

  const [updated] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(appointmentsTable.id, parseInt(req.params.appointmentId)),
        eq(appointmentsTable.patientId, user.id)
      )
    )
    .returning();

  if (!updated) { res.status(404).json({ error: "Appointment not found" }); return; }
  res.json(updated);
});

router.get("/admin/appointments", requireAdmin, async (req, res) => {
  const appointments = await db
    .select()
    .from(appointmentsTable)
    .orderBy(desc(appointmentsTable.createdAt))
    .limit(100);
  res.json(appointments);
});

export default router;
