import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hospitalsTable } from "./hospitals";

export const hospitalSettingsTable = pgTable("hospital_settings", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id).unique(),
  logoUrl: text("logo_url"),
  letterheadConfig: jsonb("letterhead_config").$type<{
    headerText?: string;
    footerText?: string;
    primaryColor?: string;
  }>().default({}),
  signatureBlockTemplate: text("signature_block_template"),
  googleWorkspaceConfig: jsonb("google_workspace_config").$type<{
    connectedEmail?: string;
    calendarId?: string;
    autoGenerateMeet?: boolean;
  }>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHospitalSettingsSchema = createInsertSchema(hospitalSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHospitalSettings = z.infer<typeof insertHospitalSettingsSchema>;
export type HospitalSettings = typeof hospitalSettingsTable.$inferSelect;
