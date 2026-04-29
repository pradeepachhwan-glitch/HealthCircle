import { pgTable, integer, timestamp, varchar, primaryKey, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const postReactionsTable = pgTable("post_reactions", {
  postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 16 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.postId, t.userId] }),
  index("post_reactions_post_idx").on(t.postId),
  index("post_reactions_post_emoji_idx").on(t.postId, t.emoji),
]);

export type PostReaction = typeof postReactionsTable.$inferSelect;
