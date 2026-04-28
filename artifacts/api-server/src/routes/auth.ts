import { Router, type IRouter, type Request, type Response } from "express";
import { z } from "zod/v4";
import {
  clearSession,
  consumeOtp,
  createSession,
  findOrCreateUserByEmail,
  getSessionId,
  isValidEmail,
  issueOtpForEmail,
  normalizeEmail,
  setSessionCookie,
} from "../lib/auth";
import { buildOtpEmail, sendEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const requestOtpSchema = z.object({ email: z.string().min(3).max(320) });
const verifyOtpSchema = z.object({
  email: z.string().min(3).max(320),
  code: z.string().min(4).max(8),
});

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
  };
}

router.get("/auth/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.json({ user: null });
    return;
  }
  res.json({ user: userResponse(req.user) });
});

router.post("/auth/request-otp", async (req: Request, res: Response) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  const email = normalizeEmail(parsed.data.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  try {
    const result = await issueOtpForEmail(email);
    if (!result.ok) {
      if (result.reason === "cooldown") {
        const seconds = Math.max(1, Math.ceil((result.retryAfterMs ?? 30_000) / 1000));
        res.status(429).json({ error: `Please wait ${seconds}s before requesting another code.`, retryAfterSeconds: seconds });
        return;
      }
      res.status(400).json({ error: "Please enter a valid email address." });
      return;
    }

    const code = result.code!;
    const { subject, text, html } = buildOtpEmail(code);

    // Audit log: NEVER log the raw code in production. In dev (no email
    // provider configured) we surface it so a developer can sign in without
    // a real inbox; in prod we only log metadata so log access cannot lead
    // to account takeover.
    const isDevNoEmail = !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production";
    if (isDevNoEmail) {
      logger.info({ to: email, code }, "[auth] OTP issued (dev mode — code shown in logs)");
    } else {
      logger.info({ to: email }, "[auth] OTP issued");
    }

    try {
      await sendEmail({ to: email, subject, text, html });
    } catch (err) {
      // Don't 500 if email send fails — the OTP is still valid; the user can
      // ask for another one. Operators see the failure in logs.
      logger.error({ err, to: email }, "[auth] OTP email send failed");
    }

    res.json({
      success: true,
      message: "If that email is valid, we've sent you a 6-digit sign-in code.",
    });
  } catch (err) {
    logger.error({ err }, "[auth] request-otp failed");
    res.status(500).json({ error: "Could not send code right now. Please try again." });
  }
});

router.post("/auth/verify-otp", async (req: Request, res: Response) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter the 6-digit code from your email." });
    return;
  }
  const email = normalizeEmail(parsed.data.email);
  const code = parsed.data.code.trim();
  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }

  try {
    const result = await consumeOtp(email, code);
    if (!result.ok) {
      const map: Record<string, string> = {
        no_otp: "No active code for this email. Please request a new one.",
        expired: "That code has expired. Please request a new one.",
        too_many_attempts: "Too many wrong attempts. Please request a new code.",
        wrong_code: "That code is incorrect. Please try again.",
      };
      res.status(400).json({ error: map[result.reason ?? "wrong_code"] ?? "Invalid code." });
      return;
    }

    const user = await findOrCreateUserByEmail(email);
    if (user.isBanned) {
      res.status(403).json({ error: "This account has been suspended. Please contact support." });
      return;
    }

    const sid = await createSession({ userId: user.id });
    setSessionCookie(res, sid);

    res.json({ success: true, user: userResponse(user as NonNullable<Request["user"]>) });
  } catch (err) {
    logger.error({ err }, "[auth] verify-otp failed");
    res.status(500).json({ error: "Could not verify your code right now. Please try again." });
  }
});

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
