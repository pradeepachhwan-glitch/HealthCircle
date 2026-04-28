import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const tcMessages = pgTable("tc_messages", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").notNull(),
  senderId: integer("sender_id").notNull(),
  senderRole: text("sender_role").notNull().default("patient"),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
