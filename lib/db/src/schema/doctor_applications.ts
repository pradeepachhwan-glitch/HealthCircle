import { pgTable, serial, integer, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const DOCTOR_APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type DoctorApplicationStatus = typeof DOCTOR_APPLICATION_STATUSES[number];

export const doctorApplicationsTable = pgTable(
  "doctor_applications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    specialty: text("specialty").notNull(),
    registrationNumber: text("registration_number").notNull(),
    experienceYears: integer("experience_years").notNull().default(0),
    location: text("location").notNull().default(""),
    languages: text("languages").array().notNull().default(["en"]),
    bio: text("bio"),
    consultationFee: numeric("consultation_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    status: text("status", { enum: DOCTOR_APPLICATION_STATUSES }).notNull().default("pending"),
    reviewerUserId: integer("reviewer_user_id").references(() => usersTable.id, { onDelete: "set null" }),
    reviewerNotes: text("reviewer_notes"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("doctor_apps_user_idx").on(t.userId),
    index("doctor_apps_status_idx").on(t.status),
    index("doctor_apps_created_idx").on(t.createdAt),
  ],
);

export const insertDoctorApplicationSchema = createInsertSchema(doctorApplicationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reviewerUserId: true,
  reviewerNotes: true,
  decidedAt: true,
  status: true,
});
export type InsertDoctorApplication = z.infer<typeof insertDoctorApplicationSchema>;
export type DoctorApplication = typeof doctorApplicationsTable.$inferSelect;
