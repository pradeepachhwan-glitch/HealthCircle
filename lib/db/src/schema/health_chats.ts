import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const healthChatSessionsTable = pgTable("health_chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New Chat"),
  language: text("language").notNull().default("en"),
  // Optional community context — when a session is opened from a specific
  // HealthCircle community ("Heart Circle", "Mind Space", etc.) we store
  // the slug + display name so every message in the session uses the matching
  // Yukti specialist persona without re-passing it from the client.
  communitySlug: text("community_slug"),
  communityName: text("community_name"),
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
  // Doctor-in-the-loop verification. Only meaningful for assistant messages.
  // 'pending' is the honest default for any AI-generated reply: a real
  // physician has not yet reviewed it. 'verified' is set by a medical pro
  // through the verify endpoint. We snapshot the doctor's display name at
  // verification time so the badge keeps reading correctly even if their
  // profile changes later.
  verificationStatus: text("verification_status", { enum: ["pending", "verified"] }),
  verifiedById: integer("verified_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  verifiedByName: text("verified_by_name"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHealthChatSessionSchema = createInsertSchema(healthChatSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHealthChatMessageSchema = createInsertSchema(healthChatMessagesTable).omit({ id: true, createdAt: true });

export type HealthChatSession = typeof healthChatSessionsTable.$inferSelect;
export type HealthChatMessage = typeof healthChatMessagesTable.$inferSelect;
export type InsertHealthChatSession = z.infer<typeof insertHealthChatSessionSchema>;
export type InsertHealthChatMessage = z.infer<typeof insertHealthChatMessageSchema>;
