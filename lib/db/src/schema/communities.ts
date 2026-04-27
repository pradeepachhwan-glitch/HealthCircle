import { pgTable, text, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communitiesTable = pgTable("communities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconEmoji: text("icon_emoji"),
  coverColor: text("cover_color"),
  isArchived: boolean("is_archived").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  premiumPriceInr: integer("premium_price_inr").notNull().default(0),
  premiumPerks: text("premium_perks"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCommunitySchema = createInsertSchema(communitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type Community = typeof communitiesTable.$inferSelect;
