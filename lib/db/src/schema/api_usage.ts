import { pgTable, integer, text, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const apiUsageTable = pgTable(
  "api_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    dayKey: text("day_key").notNull(),
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    userDayUq: uniqueIndex("api_usage_user_day_uq").on(t.userId, t.dayKey),
  }),
);

export type ApiUsage = typeof apiUsageTable.$inferSelect;
