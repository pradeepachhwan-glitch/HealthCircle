import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { postsTable } from "./posts";

export const aiSummariesTable = pgTable("ai_summaries", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().unique().references(() => postsTable.id, { onDelete: "cascade" }),
  whatItCouldBe: text("what_it_could_be").notNull(),
  riskLevel: text("risk_level", { enum: ["low", "medium", "high", "emergency"] }).notNull().default("low"),
  whatToDo: text("what_to_do").notNull(),
  whenToSeeDoctor: text("when_to_see_doctor").notNull(),
  disclaimer: text("disclaimer").notNull(),
  fullResponse: jsonb("full_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiSummarySchema = createInsertSchema(aiSummariesTable).omit({ id: true, createdAt: true });
export type AiSummary = typeof aiSummariesTable.$inferSelect;
export type InsertAiSummary = z.infer<typeof insertAiSummarySchema>;
