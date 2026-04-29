import { integer, pgTable, primaryKey, timestamp, index } from "drizzle-orm/pg-core";
import { postsTable } from "./posts";
import { usersTable } from "./users";

export const postBookmarksTable = pgTable(
  "post_bookmarks",
  {
    postId: integer("post_id").notNull().references(() => postsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.postId, t.userId] }),
    userIdx: index("post_bookmarks_user_idx").on(t.userId),
    postIdx: index("post_bookmarks_post_idx").on(t.postId),
  }),
);

export type PostBookmark = typeof postBookmarksTable.$inferSelect;
