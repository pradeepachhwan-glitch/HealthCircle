import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

export const googleTokensTable = pgTable("google_tokens", {
  userId: integer("user_id").primaryKey(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  googleEmail: text("google_email"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
