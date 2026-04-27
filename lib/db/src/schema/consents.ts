import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const consentsTable = pgTable("consents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  consentType: text("consent_type", { enum: ["post_health_data", "ai_assistance"] }).notNull(),
  accepted: boolean("accepted").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConsentSchema = createInsertSchema(consentsTable).omit({ id: true, createdAt: true });
export type Consent = typeof consentsTable.$inferSelect;
export type InsertConsent = z.infer<typeof insertConsentSchema>;
