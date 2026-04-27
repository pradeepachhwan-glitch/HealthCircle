import { pgTable, integer, text, timestamp, serial, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { communitiesTable } from "./communities";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  communityId: integer("community_id").references(() => communitiesTable.id, { onDelete: "set null" }),
  provider: text("provider").notNull().default("razorpay"),
  purpose: text("purpose").notNull(),
  amountInr: integer("amount_inr").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status", { enum: ["created", "paid", "failed", "refunded"] }).notNull().default("created"),
  providerOrderId: text("provider_order_id").notNull().unique(),
  providerPaymentId: text("provider_payment_id"),
  providerSignature: text("provider_signature"),
  notes: jsonb("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Payment = typeof paymentsTable.$inferSelect;
