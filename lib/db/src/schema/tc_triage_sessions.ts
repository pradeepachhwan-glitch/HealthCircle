import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const tcTriageSessions = pgTable("tc_triage_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  chiefComplaint: text("chief_complaint").notNull(),
  symptomsJson: text("symptoms_json"),
  duration: text("duration"),
  severity: integer("severity"),
  medicalHistory: text("medical_history"),
  medications: text("medications"),
  vitals: text("vitals"),
  riskLevel: text("risk_level"),
  summary: text("summary"),
  suggestedSpecialty: text("suggested_specialty"),
  suggestedConsultType: text("suggested_consult_type"),
  rawAiResponse: text("raw_ai_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
