import { pgTable, text, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { communitiesTable } from "./communities";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  communityId: integer("community_id").notNull().references(() => communitiesTable.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  isPinned: boolean("is_pinned").notNull().default(false),
  isBroadcast: boolean("is_broadcast").notNull().default(false),
  isModerated: boolean("is_moderated").notNull().default(false),
  isExpertAnswered: boolean("is_expert_answered").notNull().default(false),
  upvoteCount: integer("upvote_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  // --- In-app content layer (optional; null/'discussion' for legacy posts) ---
  // Posts can carry an embedded content payload (YouTube video, audio, or
  // sandboxed article) that is rendered inline in the feed. When contentType
  // is 'discussion' (default) the post behaves exactly as before.
  contentType: text("content_type").notNull().default("discussion"), // 'discussion' | 'video' | 'article' | 'audio'
  contentUrl: text("content_url"),
  contentSource: text("content_source"),                              // 'youtube' | 'ted' | 'vimeo' | 'spotify' | 'external'
  contentThumbnail: text("content_thumbnail"),
  contentDurationSec: integer("content_duration_sec"),
  contentSummary: text("content_summary"),                            // AI-generated or admin-curated summary
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
