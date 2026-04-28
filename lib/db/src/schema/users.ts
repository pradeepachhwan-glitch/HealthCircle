import { pgTable, text, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const USER_ROLES = ["admin", "moderator", "medical_professional", "member"] as const;
export type UserRole = typeof USER_ROLES[number];

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  mobileNumber: text("mobile_number").unique(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: USER_ROLES }).notNull().default("member"),
  isBanned: boolean("is_banned").notNull().default(false),
  healthCredits: integer("health_credits").notNull().default(0),
  weeklyCredits: integer("weekly_credits").notNull().default(0),
  level: integer("level").notNull().default(1),
  specialty: text("specialty"),
  registrationNumber: text("registration_number"),
  isVerifiedPro: boolean("is_verified_pro").notNull().default(false),
  subscriptionExpiresAt: timestamp("subscription_expires_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
