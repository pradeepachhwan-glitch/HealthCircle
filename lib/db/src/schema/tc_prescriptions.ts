import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const tcPrescriptions = pgTable("tc_prescriptions", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").notNull(),
  icdCodes: text("icd_codes"),
  medicationsJson: text("medications_json"),
  instructions: text("instructions"),
  followUpDate: text("follow_up_date"),
  redFlags: text("red_flags"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
