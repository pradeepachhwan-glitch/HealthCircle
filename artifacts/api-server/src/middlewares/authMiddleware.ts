import type { Request, Response, NextFunction } from "express";
import { db, usersTable, type User as DbUser } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getSessionId,
  getSessionRow,
  setSessionCookie,
  touchSession,
} from "../lib/auth";

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends DbUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
    }

    interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSessionRow(sid);
  if (!session?.userId) {
    await clearSession(res, sid);
    next();
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = user as Express.User;
  // Slide both server-side session expiry AND the browser cookie expiry
  // forward so active users don't get logged out at the 30-day mark. Both are
  // best-effort and must not block the request.
  void touchSession(sid).catch(() => {});
  try {
    setSessionCookie(res, sid);
  } catch {
    /* response may already be committed by then in rare paths */
  }
  next();
}
