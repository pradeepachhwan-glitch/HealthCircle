import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hospitalsTable } from "./hospitals";
import { usersTable } from "./users";

export const CARE_TEAM_ROLES = ["doctor", "nurse", "admin", "front_desk"] as const;
export type CareTeamRole = typeof CARE_TEAM_ROLES[number];

export const hospitalCareTeamTable = pgTable("hospital_care_team", {
  id: serial("id").primaryKey(),
  hospitalId: integer("hospital_id").notNull().references(() => hospitalsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  role: text("role", { enum: CARE_TEAM_ROLES }).notNull().default("doctor"),
  isPrimary: boolean("is_primary").notNull().default(false),
  specialty: text("specialty"),
  signatureUrl: text("signature_url"),
  credentials: text("credentials"), // e.g. "MBBS, MD"
  registrationNumber: text("registration_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHospitalCareTeamSchema = createInsertSchema(hospitalCareTeamTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHospitalCareTeam = z.infer<typeof insertHospitalCareTeamSchema>;
export type HospitalCareTeam = typeof hospitalCareTeamTable.$inferSelect;
