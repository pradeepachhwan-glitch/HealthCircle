import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, Response } from "express";
import { getAuth } from "@clerk/express";

/**
 * Rate-limiter middlewares for HealthCircle.
 *
 * Key derivation prefers the authenticated Clerk userId so users on shared NAT
 * (e.g. office/college Wi-Fi) aren't punished for each other. Falls back to
 * the IPv6-safe ipKeyGenerator from express-rate-limit (required by v8+).
 *
 * All limits are intentionally generous for normal users — the goal is to stop
 * runaway scripts and abusive traffic, not to slow down a real person.
 */
function keyByUser(req: Request, res: Response): string {
  try {
    const { userId } = getAuth(req);
    if (userId) return `u:${userId}`;
  } catch {
    /* getAuth throws if Clerk middleware hasn't run on this path — fall through to IP */
  }
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

function keyByIp(req: Request, res: Response): string {
  return `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

const baseOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
};

// AI / LLM endpoints — protect Anthropic/OpenAI budget. 30 req per 15 min per user.
export const aiRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 30,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      message: "You've reached the AI message limit. Please wait 15 minutes and try again.",
      retryAfter: 15 * 60,
    });
  },
});

// Whole-API safety net — 200 req per minute per user. Catches runaway clients.
export const generalRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: 200,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      message: "Too many requests. Please slow down and try again in a moment.",
      retryAfter: 60,
    });
  },
});

// Admin endpoints — tighter, since admins shouldn't need a flood.
export const adminRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: 60,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      message: "Admin rate limit hit. Wait a minute and retry.",
      retryAfter: 60,
    });
  },
});

// Public, unauthenticated AI demo on the landing page. Keep this VERY tight
// since there's no user behind the call to attribute spend to. 5 req per hour
// per IP (a real human only ever needs 1 — the rest is anti-abuse headroom).
export const publicAiRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: keyByIp,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      message: "Too many demo questions from this device. Please sign up to continue asking Yukti.",
      retryAfter: 60 * 60,
    });
  },
});

// Auth-adjacent endpoints (sign-in, password reset lookup, etc.) — keep tight to
// thwart brute force / enumeration. 20 req per minute per IP.
export const authRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  max: 20,
  // Always key by IP for auth — the user is by definition not yet authenticated.
  keyGenerator: keyByIp,
  handler: (_req, res) => {
    res.status(429).json({
      error: "rate_limited",
      message: "Too many attempts. Please wait a minute before trying again.",
      retryAfter: 60,
    });
  },
});
