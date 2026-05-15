import { Router, type Request, type Response } from "express";
import { db, doctorAvailabilityTable, appointmentsTable, doctorsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";
import { logger } from "../lib/logger";
import { z } from "zod/v4";
import { format, addMinutes, startOfDay, endOfDay, parse } from "date-fns";

const router = Router();

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const [doctor] = await db.select().from(doctorsTable).where(eq(doctorsTable.userId, req.user!.id)).limit(1);
    res.json(doctor || null);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch doctor profile" });
  }
});

// ---- 1. MANAGE AVAILABILITY (Doctor Side) ----
const setAvailabilitySchema = z.object({
  doctorId: z.number(),
  slots: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:mm
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    slotDuration: z.number().default(30),
  })),
});

router.post("/availability", requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = setAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid availability data", details: parsed.error });
      return;
    }

    // Security check: ensure doctorId belongs to user or hospital has permission
    // For now, simple check
    const { doctorId, slots } = parsed.data;

    // Clear existing and insert new
    await db.delete(doctorAvailabilityTable).where(eq(doctorAvailabilityTable.doctorId, doctorId));
    
    if (slots.length > 0) {
      await db.insert(doctorAvailabilityTable).values(
        slots.map(s => ({ ...s, doctorId }))
      );
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to set availability");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/availability/:doctorId", async (req: Request, res: Response) => {
  try {
    const doctorId = parseInt(req.params.doctorId);
    const availability = await db.select().from(doctorAvailabilityTable).where(eq(doctorAvailabilityTable.doctorId, doctorId));
    res.json(availability);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

// ---- 2. SLOT CALCULATION (Patient Side) ----
router.get("/slots", async (req: Request, res: Response) => {
  try {
    const doctorId = parseInt(req.query.doctorId as string);
    const dateStr = req.query.date as string; // YYYY-MM-DD

    if (!doctorId || !dateStr) {
      res.status(400).json({ error: "Missing doctorId or date" });
      return;
    }

    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();

    // 1. Get doctor's availability for this day of week
    const availability = await db.select()
      .from(doctorAvailabilityTable)
      .where(and(
        eq(doctorAvailabilityTable.doctorId, doctorId),
        eq(doctorAvailabilityTable.dayOfWeek, dayOfWeek)
      ));

    if (availability.length === 0) {
      res.json([]);
      return;
    }

    // 2. Get existing appointments for this doctor on this day
    const existingAppointments = await db.select()
      .from(appointmentsTable)
      .where(and(
        eq(appointmentsTable.doctorId, doctorId),
        sql`date_trunc('day', ${appointmentsTable.appointmentTime}) = ${startOfDay(date).toISOString()}::timestamp`,
        sql`${appointmentsTable.status} != 'cancelled'`
      ));

    const bookedTimes = new Set(existingAppointments.map(a => format(new Date(a.appointmentTime), "HH:mm")));

    // 3. Generate slots
    const allSlots: string[] = [];
    availability.forEach(rule => {
      let current = parse(rule.startTime, "HH:mm", date);
      const end = parse(rule.endTime, "HH:mm", date);

      while (current < end) {
        const timeStr = format(current, "HH:mm");
        if (!bookedTimes.has(timeStr)) {
          allSlots.push(timeStr);
        }
        current = addMinutes(current, rule.slotDuration);
      }
    });

    res.json(allSlots);
  } catch (err) {
    logger.error({ err }, "Failed to calculate slots");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
