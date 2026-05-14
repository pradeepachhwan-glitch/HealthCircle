import { Router } from "express";
import { db } from "../../../lib/db";
import { appointments, doctorAvailability } from "../../../lib/db/schema";
import { and, eq } from "drizzle-orm";

const router = Router();

router.post("/book", async (req, res) => {
  const { doctorId, patientId, slotTime } = req.body;

  // 1. Check for double booking
  const existing = await db.select().from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.slotTime, new Date(slotTime))));

  if (existing.length > 0) {
    return res.status(400).json({ error: "Slot already booked" });
  }

  // 2. Insert appointment
  await db.insert(appointments).values({
    doctorId,
    patientId,
    slotTime: new Date(slotTime),
  });

  res.json({ success: true });
});

export default router;
