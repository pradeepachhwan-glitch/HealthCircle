import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const searchLogsTable = pgTable("search_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  intent: text("intent"),
  riskLevel: text("risk_level"),
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

// NOTE: The audit log table lives in `./audit_log.ts` (auditLogTable) and is
// the canonical, in-use audit log. The previous `auditLogsTable` definition
// here was a never-used stub that conflicted with that canonical export and
// has been removed.

export const insertSearchLogSchema = createInsertSchema(searchLogsTable).omit({ id: true, createdAt: true });
export const insertProviderRankingSchema = createInsertSchema(providerRankingsTable).omit({ id: true, updatedAt: true });

export type SearchLog = typeof searchLogsTable.$inferSelect;
export type ProviderRanking = typeof providerRankingsTable.$inferSelect;
