import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { doctorsTable } from "./doctors";
import { hospitalsTable } from "./hospitals";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  doctorId: integer("doctor_id").references(() => doctorsTable.id, { onDelete: "set null" }),
  hospitalId: integer("hospital_id").references(() => hospitalsTable.id, { onDelete: "set null" }),
  appointmentTime: timestamp("appointment_time", { withTimezone: true }).notNull(),
  status: text("status", { enum: ["booked", "completed", "cancelled"] }).notNull().default("booked"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppointmentSchema = createInsertSchema(appointmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointmentsTable.$inferSelect;
