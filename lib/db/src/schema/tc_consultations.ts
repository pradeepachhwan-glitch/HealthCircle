import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const tcConsultations = pgTable("tc_consultations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  doctorId: integer("doctor_id"),
  triageSessionId: integer("triage_session_id"),
  type: text("type").notNull().default("video"),
  status: text("status").notNull().default("pending"),
  triageScore: text("triage_score"),
  chiefComplaint: text("chief_complaint"),
  consentGiven: text("consent_given").default("false"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  consultationFee: numeric("consultation_fee", { precision: 10, scale: 2 }),
  notes: text("notes"),
  diagnosis: text("diagnosis"),
  followUpInstructions: text("follow_up_instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
