import { pgTable, integer, timestamp, serial, unique, boolean, text } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { communitiesTable } from "./communities";

export const communityMembersTable = pgTable("community_members", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  hasPremiumAccess: boolean("has_premium_access").notNull().default(false),
  premiumPaymentId: text("premium_payment_id"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.communityId, t.userId)]);

export type CommunityMember = typeof communityMembersTable.$inferSelect;
