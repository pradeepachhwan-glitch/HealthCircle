import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const searchLogsTable = pgTable("search_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  intent: text("intent"),
  clickedResult: text("clicked_result"),
  language: text("language").notNull().default("en"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerRankingsTable = pgTable("provider_rankings", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  providerType: text("provider_type", { enum: ["doctor", "hospital"] }).notNull(),
  boostScore: numeric("boost_score", { precision: 5, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  performedBy: integer("performed_by").references(() => usersTable.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSearchLogSchema = createInsertSchema(searchLogsTable).omit({ id: true, createdAt: true });
export const insertProviderRankingSchema = createInsertSchema(providerRankingsTable).omit({ id: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });

export type SearchLog = typeof searchLogsTable.$inferSelect;
export type ProviderRanking = typeof providerRankingsTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
