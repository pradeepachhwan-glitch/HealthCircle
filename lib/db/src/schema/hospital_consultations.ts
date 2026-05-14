import { pgTable, serial, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hospitalsTable } from "./hospitals";
import { usersTable } from "./users";

export const CONSULT_STATUS = ["requested", "scheduled", "in_progress", "completed", "cancelled"] as const;
export type ConsultStatus = typeof CONSULT_STATUS[number];

export const hospitalConsultationsTable = pgTable("hospital_consultations", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id),
  patientId: integer("patient_id").notNull().references(() => usersTable.id),
  doctorId: integer("doctor_id").references(() => usersTable.id),
  
  status: text("status", { enum: CONSULT_STATUS }).notNull().default("requested"),
  
  // Scheduling & Meet
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  googleEventId: text("google_event_id"),
  googleMeetUrl: text("google_meet_url"),
  
  // Clinical Workflow
  intakeSummary: text("intake_summary"),
  notes: text("notes"),
  vitalsJson: jsonb("vitals_json"),
  transcript: text("transcript"),
  soapDraft: jsonb("soap_draft").$type<{
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  }>(),
  isApproved: boolean("is_approved").notNull().default(false),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  
  // Documentation
  clinicalNoteUrl: text("clinical_note_url"),
  signatureBlockUsed: text("signature_block_used"),
  
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHospitalConsultationSchema = createInsertSchema(hospitalConsultationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHospitalConsultation = z.infer<typeof insertHospitalConsultationSchema>;
export type HospitalConsultation = typeof hospitalConsultationsTable.$inferSelect;
