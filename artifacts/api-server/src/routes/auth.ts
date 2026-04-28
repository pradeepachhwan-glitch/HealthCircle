import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  PASSWORD_MAX_LEN,
  PASSWORD_MIN_LEN,
  clearSession,
  consumeOtp,
  createSession,
  findOrCreateUserByEmail,
  getSessionId,
  hashPassword,
  isValidEmail,
  isValidPassword,
  issueOtpForEmail,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
  checkLoginLockout,
  recordLoginFailure,
  clearLoginFailures,
  LOGIN_LOCKOUT_MS,
  type OtpPurpose,
} from "../lib/auth";
import { buildOtpEmail, sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---- Shared helpers --------------------------------------------------------

function userResponse(u: NonNullable<Request["user"]>) {
  return {
    id: u.id,
    clerkId: u.clerkId,
    email: u.email,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    isBanned: u.isBanned,
    username: u.username,
    mobileNumber: u.mobileNumber,
    healthCredits: u.healthCredits,
    level: u.level,
    emailVerifiedAt: (u as unknown as { emailVerifiedAt: Date | null }).emailVerifiedAt ?? null,
  };
}

const consumeReasonMessages: Record<string, string> = {
  no_otp: "No active code for this email. Please request a new one.",
  expired: "That code has expired. Please request a new one.",
  too_many_attempts: "Too many wrong attempts. Please request a new code.",
  wrong_code: "That code is incorrect. Please try again.",
};

async function sendOtpEmail(email: string, code: string, purpose: OtpPurpose): Promise<void> {
  const { subject, text, html } = buildOtpEmail(code, purpose);

  // Audit log: NEVER log the raw code in production. In dev (no email
  // provider configured) we surface it so a developer can complete the flow
  // without a real inbox.
  const isDevNoEmail = !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production";
  if (isDevNoEmail) {
    logger.info({ to: email, purpose, code }, "[auth] OTP issued (dev mode — code shown in logs)");
  } else {
    logger.info({ to: email, purpose }, "[auth] OTP issued");
  }

  try {
    await sendEmail({ to: email, subject, text, html });
  } catch (err) {
    logger.error({ err, to: email, purpose }, "[auth] OTP email send failed");
  }
}

function badEmail(res: Response): void {
  res.status(400).json({ error: "Please enter a valid email address." });
}

function weakPassword(res: Response): void {
  res.status(400).json({
    error: `Password must be ${PASSWORD_MIN_LEN}–${PASSWORD_MAX_LEN} characters.`,
  });
}

// ---- Schemas ---------------------------------------------------------------

const emailSchema = z.object({ email: z.string().min(3).max(320) });
const emailCodeSchema = z.object({
  email: z.string().min(3).max(320),
  code: z.string().min(4).max(8),
});
const signupSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(PASSWORD_MIN_LEN).max(PASSWORD_MAX_LEN),
  displayName: z.string().min(1).max(80).optional(),
});
const loginSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(PASSWORD_MAX_LEN),
});
const resetSchema = z.object({
  email: z.string().min(3).max(320),
  code: z.string().min(4).max(8),
  newPassword: z.string().min(PASSWORD_MIN_LEN).max(PASSWORD_MAX_LEN),
});

// ---- Current user ---------------------------------------------------------

router.get("/auth/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ user: null });
    return;
  }
  res.json({ user: userResponse(req.user) });
});

// ---- Sign up: email + password (sends a verification OTP) -----------------

router.post("/auth/signup", async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path.includes("password"))) {
      weakPassword(res);
      return;
    }
    badEmail(res);
    return;
  }

  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);
  if (!isValidPassword(parsed.data.password)) return weakPassword(res);

  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    // SECURITY: Any account that has already verified its email — whether or
    // not it currently has a password — must NOT have its password set via
    // /auth/signup. Otherwise an attacker submitting a victim's email plus
    // their own password could overwrite the password and then log in (a
    // direct account-takeover path for legacy passwordless users).
    if (existing && existing.emailVerifiedAt) {
      res.status(409).json({
        error: "An account already exists for that email. Try signing in instead, or use “Forgot password.”",
      });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const displayName = parsed.data.displayName?.trim() || email.split("@")[0] || "Healthcare Member";

    if (existing) {
      // Pre-existing UNVERIFIED row (abandoned signup). Safe to update the
      // password since email ownership has not yet been proved by anyone.
      await db
        .update(usersTable)
        .set({
          passwordHash,
          displayName: existing.displayName === existing.email.split("@")[0] ? displayName : existing.displayName,
        })
        .where(eq(usersTable.id, existing.id));
    } else {
      await db.insert(usersTable).values({
        clerkId: `email:${email}`,
        displayName,
        email,
        avatarUrl: null,
        role: "member",
        isBanned: false,
        healthCredits: 0,
        weeklyCredits: 0,
        level: 1,
        passwordHash,
        emailVerifiedAt: null,
      });
    }

    const issued = await issueOtpForEmail(email, "signup");
    if (!issued.ok) {
      if (issued.reason === "cooldown") {
        const seconds = Math.max(1, Math.ceil((issued.retryAfterMs ?? 30_000) / 1000));
        res.status(429).json({
          error: `We just sent a code. Please wait ${seconds}s before requesting another.`,
          retryAfterSeconds: seconds,
        });
        return;
      }
      return badEmail(res);
    }

    await sendOtpEmail(email, issued.code!, "signup");
    res.json({ success: true, message: "Account created. We've emailed you a 6-digit verification code." });
  } catch (err) {
    logger.error({ err }, "[auth] signup failed");
    res.status(500).json({ error: "Could not create your account right now. Please try again." });
  }
});

// ---- Verify email (consumes signup OTP, signs the user in) ----------------

router.post("/auth/verify-email", async (req: Request, res: Response) => {
  const parsed = emailCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter the 6-digit code from your email." });
    return;
  }
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);

  try {
    const result = await consumeOtp(email, parsed.data.code, "signup");
    if (!result.ok) {
      res.status(400).json({ error: consumeReasonMessages[result.reason ?? "wrong_code"] ?? "Invalid code." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(400).json({ error: "We couldn't find that account. Please sign up again." });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "This account has been suspended. Please contact support." });
      return;
    }

    if (!user.emailVerifiedAt) {
      await db.update(usersTable).set({ emailVerifiedAt: new Date() }).where(eq(usersTable.id, user.id));
    }

    const sid = await createSession({ userId: user.id });
    setSessionCookie(res, sid);
    res.json({
      success: true,
      user: userResponse({ ...user, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } as NonNullable<Request["user"]>),
    });
  } catch (err) {
    logger.error({ err }, "[auth] verify-email failed");
    res.status(500).json({ error: "Could not verify your code right now. Please try again." });
  }
});

// ---- Email + password login ----------------------------------------------

router.post("/auth/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your email and password to sign in." });
    return;
  }
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);

  // Per-email soft-lockout: check BEFORE touching the DB so a locked
  // account bails out cheaply without a DB round-trip.
  const lockout = checkLoginLockout(email);
  if (lockout.locked) {
    const mins = Math.max(1, Math.ceil((lockout.retryAfterMs ?? LOGIN_LOCKOUT_MS) / 60_000));
    res.status(429).json({
      error: `Too many failed sign-in attempts. Please wait ${mins} minute(s) and try again.`,
      retryAfterSeconds: Math.ceil((lockout.retryAfterMs ?? LOGIN_LOCKOUT_MS) / 1000),
    });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    // Generic message for both "no such user" and "wrong password" so we
    // don't reveal whether an email is registered. We still record a failure
    // so a distributed brute-force attempt is slowed down.
    const wrong = () => {
      recordLoginFailure(email);
      res.status(401).json({ error: "That email or password didn't match. Please try again." });
    };

    if (!user || !user.passwordHash) return wrong();
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) return wrong();

    // Successful credential match — clear any accumulated failure count.
    clearLoginFailures(email);

    if (user.isBanned) {
      res.status(403).json({ error: "This account has been suspended. Please contact support." });
      return;
    }

    if (!user.emailVerifiedAt) {
      // Account exists with password but never finished verification. Re-send
      // the signup OTP so they can complete it.
      const issued = await issueOtpForEmail(email, "signup");
      if (issued.ok) await sendOtpEmail(email, issued.code!, "signup");
      res.status(403).json({
        error: "Please verify your email first — we just sent you a fresh 6-digit code.",
        needsVerification: true,
      });
      return;
    }

    const sid = await createSession({ userId: user.id });
    setSessionCookie(res, sid);
    res.json({ success: true, user: userResponse(user as NonNullable<Request["user"]>) });
  } catch (err) {
    logger.error({ err }, "[auth] login failed");
    res.status(500).json({ error: "Could not sign you in right now. Please try again." });
  }
});

// ---- Forgot password: send reset OTP --------------------------------------

router.post("/auth/request-password-reset", async (req: Request, res: Response) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return badEmail(res);
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);

  // ALWAYS return the same generic success envelope regardless of whether the
  // email belongs to a real account, is banned, or is currently in cool-down.
  // Diverging the response (e.g. emitting a 429 only for real accounts) gives
  // attackers a reliable existence oracle, so we silently no-op those cases.
  const genericReply = {
    success: true,
    message: "If an account exists for that email, we've sent a 6-digit reset code.",
  };

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user && !user.isBanned) {
      const issued = await issueOtpForEmail(email, "reset");
      if (issued.ok && issued.code) {
        await sendOtpEmail(email, issued.code, "reset");
      } else {
        logger.info({ email, reason: issued.reason }, "[auth] reset OTP not sent (silent)");
      }
    }
    res.json(genericReply);
  } catch (err) {
    logger.error({ err }, "[auth] request-password-reset failed");
    // Even on internal failure return the generic envelope so the response
    // shape is identical from the attacker's perspective.
    res.json(genericReply);
  }
});

// Re-send a signup verification code WITHOUT touching the password. Safe to
// call from the "needs verification" branch of the sign-in flow.
router.post("/auth/resend-verification", async (req: Request, res: Response) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return badEmail(res);
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);

  const genericReply = {
    success: true,
    message: "If your account needs verification, we've sent a fresh 6-digit code.",
  };

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (user && !user.isBanned && !user.emailVerifiedAt && user.passwordHash) {
      const issued = await issueOtpForEmail(email, "signup");
      if (issued.ok && issued.code) {
        await sendOtpEmail(email, issued.code, "signup");
      } else {
        logger.info({ email, reason: issued.reason }, "[auth] resend-verification not sent (silent)");
      }
    }
    res.json(genericReply);
  } catch (err) {
    logger.error({ err }, "[auth] resend-verification failed");
    res.json(genericReply);
  }
});

// ---- Reset password: consume OTP + set new password + sign in -------------

router.post("/auth/reset-password", async (req: Request, res: Response) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path.includes("newPassword"))) return weakPassword(res);
    res.status(400).json({ error: "Please enter the 6-digit code and a new password." });
    return;
  }
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);
  if (!isValidPassword(parsed.data.newPassword)) return weakPassword(res);

  try {
    const result = await consumeOtp(email, parsed.data.code, "reset");
    if (!result.ok) {
      res.status(400).json({ error: consumeReasonMessages[result.reason ?? "wrong_code"] ?? "Invalid code." });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user) {
      res.status(400).json({ error: "We couldn't find that account." });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "This account has been suspended. Please contact support." });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(usersTable)
      .set({ passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() })
      .where(eq(usersTable.id, user.id));

    const sid = await createSession({ userId: user.id });
    setSessionCookie(res, sid);
    res.json({
      success: true,
      user: userResponse({ ...user, passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } as NonNullable<Request["user"]>),
    });
  } catch (err) {
    logger.error({ err }, "[auth] reset-password failed");
    res.status(500).json({ error: "Could not reset your password right now. Please try again." });
  }
});

// ---- Passwordless: request a login OTP (kept for the magic-code option) ---

router.post("/auth/request-otp", async (req: Request, res: Response) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return badEmail(res);
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);

  try {
    const result = await issueOtpForEmail(email, "login");
    if (!result.ok) {
      if (result.reason === "cooldown") {
        const seconds = Math.max(1, Math.ceil((result.retryAfterMs ?? 30_000) / 1000));
        res.status(429).json({
          error: `Please wait ${seconds}s before requesting another code.`,
          retryAfterSeconds: seconds,
        });
        return;
      }
      return badEmail(res);
    }

    await sendOtpEmail(email, result.code!, "login");
    res.json({
      success: true,
      message: "If that email is valid, we've sent you a 6-digit sign-in code.",
    });
  } catch (err) {
    logger.error({ err }, "[auth] request-otp failed");
    res.status(500).json({ error: "Could not send code right now. Please try again." });
  }
});

// ---- Passwordless: verify the login OTP ----------------------------------

router.post("/auth/verify-otp", async (req: Request, res: Response) => {
  const parsed = emailCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter the 6-digit code from your email." });
    return;
  }
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) return badEmail(res);

  try {
    const result = await consumeOtp(email, parsed.data.code, "login");
    if (!result.ok) {
      res.status(400).json({ error: consumeReasonMessages[result.reason ?? "wrong_code"] ?? "Invalid code." });
      return;
    }

    const user = await findOrCreateUserByEmail(email);
    if (user.isBanned) {
      res.status(403).json({ error: "This account has been suspended. Please contact support." });
      return;
    }

    // Magic-code login also counts as email verification.
    if (!user.emailVerifiedAt) {
      await db.update(usersTable).set({ emailVerifiedAt: new Date() }).where(eq(usersTable.id, user.id));
      user.emailVerifiedAt = new Date();
    }

    const sid = await createSession({ userId: user.id });
    setSessionCookie(res, sid);
    res.json({ success: true, user: userResponse(user as NonNullable<Request["user"]>) });
  } catch (err) {
    logger.error({ err }, "[auth] verify-otp failed");
    res.status(500).json({ error: "Could not verify your code right now. Please try again." });
  }
});

// ---- Logout ---------------------------------------------------------------

router.post("/auth/logout", async (req: Request, res: Response) => {
  try {
    const sid = getSessionId(req);
    await clearSession(res, sid);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[auth] logout failed");
    res.json({ success: true });
  }
});

// Backward-compat: some old clients hit GET /api/logout. Keep it working.
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid).catch(() => {});
  res.redirect("/");
});

export default router;
