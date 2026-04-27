import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { postsTable } from "./posts";
import { healthChatSessionsTable } from "./health_chats";

export const doctorConsultationsTable = pgTable("doctor_consultations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  postId: integer("post_id").references(() => postsTable.id, { onDelete: "cascade" }),
  chatSessionId: integer("chat_session_id").references(() => healthChatSessionsTable.id, { onDelete: "cascade" }),
  riskLevel: text("risk_level", { enum: ["low", "medium", "high", "emergency"] }).notNull().default("high"),
  reason: text("reason"),
  status: text("status", { enum: ["pending", "in_review", "resolved"] }).notNull().default("pending"),
  source: text("source", { enum: ["user_request", "ai_flag", "auto_high_risk"] }).notNull().default("user_request"),
  doctorNote: text("doctor_note"),
  resolvedById: integer("resolved_by_id").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDoctorConsultationSchema = createInsertSchema(doctorConsultationsTable).omit({ id: true, createdAt: true });
export type DoctorConsultation = typeof doctorConsultationsTable.$inferSelect;
export type InsertDoctorConsultation = z.infer<typeof insertDoctorConsultationSchema>;
