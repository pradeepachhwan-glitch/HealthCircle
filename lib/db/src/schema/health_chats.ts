import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const healthChatSessionsTable = pgTable("health_chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New Chat"),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const healthChatMessagesTable = pgTable("health_chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => healthChatSessionsTable.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  intent: text("intent"),
  structuredResponse: jsonb("structured_response"),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  attachmentName: text("attachment_name"),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthChatSessionSchema = createInsertSchema(healthChatSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHealthChatMessageSchema = createInsertSchema(healthChatMessagesTable).omit({ id: true, createdAt: true });

export type HealthChatSession = typeof healthChatSessionsTable.$inferSelect;
export type HealthChatMessage = typeof healthChatMessagesTable.$inferSelect;
export type InsertHealthChatSession = z.infer<typeof insertHealthChatSessionSchema>;
export type InsertHealthChatMessage = z.infer<typeof insertHealthChatMessageSchema>;
