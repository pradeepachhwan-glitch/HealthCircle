import { boolean, index, integer, jsonb, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// `purpose` distinguishes the three OTP flows we support so a code minted for
// password reset can never be replayed against email verification (or vice
// versa). Values: "login" (passwordless magic-code login), "signup" (verify a
// brand new account on sign-up), "reset" (password reset).
export const OTP_PURPOSES = ["login", "signup", "reset"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const emailOtpsTable = pgTable(
  "email_otps",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    codeHash: varchar("code_hash", { length: 128 }).notNull(),
    purpose: varchar("purpose", { length: 20 }).notNull().default("login"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumed: boolean("consumed").notNull().default(false),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("IDX_email_otps_email").on(table.email),
    index("IDX_email_otps_expires_at").on(table.expiresAt),
  ],
);

export type EmailOtp = typeof emailOtpsTable.$inferSelect;
