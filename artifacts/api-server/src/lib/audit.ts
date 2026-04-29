import type { Request } from "express";
import { db, auditLogTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Record an admin / privileged action to the audit log.
 *
 * Best-effort: never throws — admin actions should not fail because the
 * audit log insert failed. Errors are logged at warn level.
 *
 * The `actor` is read from `req.user.id` if available; for unauthenticated
 * audit events (rare) pass `actorUserId: null` via the meta object.
 */
export async function recordAudit(
  req: Request,
  action: string,
  target?: { type?: string | null; id?: string | number | null } | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const actorUserId = req.user?.id ?? null;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
    const userAgent = (req.headers["user-agent"] as string) || null;
    await db.insert(auditLogTable).values({
      actorUserId,
      action,
      targetType: target?.type ?? null,
      targetId: target?.id != null ? String(target.id) : null,
      meta: meta ?? null,
      ip,
      userAgent,
    });
  } catch (err) {
    // Never let audit failures break the request flow.
    logger.warn({ err, action }, "audit log insert failed");
  }
}
