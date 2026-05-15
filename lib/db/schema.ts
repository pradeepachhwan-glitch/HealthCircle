import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const doctorAvailability = pgTable("doctor_availability", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), 
  startTime: text("start_time").notNull(), 
  endTime: text("end_time").notNull(), 
  slotDuration: integer("slot_duration").default(30),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  hospitalId: integer("hospital_id").notNull(),
  slotTime: timestamp("slot_time").notNull(),
  status: text("status").default("scheduled"),
  createdAt: timestamp("created_at").defaultNow(),
});
