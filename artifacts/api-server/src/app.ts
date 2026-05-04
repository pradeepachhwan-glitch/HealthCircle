import express, { type Express, type ErrorRequestHandler } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalRateLimiter, aiRateLimiter, adminRateLimiter, authRateLimiter, publicAiRateLimiter } from "./middleware/rateLimiter";

const app: Express = express();

// Cloud Run sits behind Google's proxy. Trust one proxy hop so req.ip and
// secure-cookie related Express behavior use the original client request.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());

// IMPORTANT: authMiddleware MUST run BEFORE the API body parser. authMiddleware
// only reads cookies (no body access), so the order swap is safe — and it
// lets the parser below pick a per-request size limit based on whether the
// caller is a real authenticated user. This protects against an unauth client
// forcing a multi-megabyte parse just to be rejected with 401 afterwards.
app.use("/api", authMiddleware);

// /api/uploads/inline owns its own express.json({ limit: "8mb" }) middleware
// (declared inside the route after requireAuth). Skip the global parser there
// so the route-level one runs unimpeded.
//
// Match is intentionally lenient — strip a single trailing slash and lowercase
// the pathname so /api/uploads/inline, /api/uploads/inline/, and case
// variations all reach the route-level 8 MB parser instead of silently
// regressing to the global default.
const UPLOAD_INLINE_PATHS = new Set(["/api/uploads/inline"]);

// 8 MB matches the upload route — large enough to carry a 4 MB binary file as
// a base64 data URL (≈5.5 MB of base64 + JSON envelope) plus a little headroom.
// Authenticated users routinely send these for community logos, post images,
// and avatars; the small default (~100 KB) silently rejects them.
const AUTHED_JSON_LIMIT = "8mb";
const ANON_JSON_LIMIT = "100kb";
const authedJson = express.json({ limit: AUTHED_JSON_LIMIT });
const anonJson = express.json({ limit: ANON_JSON_LIMIT });

app.use("/api", (req, res, next) => {
  const normalised = req.path.replace(/\/+$/, "").toLowerCase();
  if (UPLOAD_INLINE_PATHS.has(normalised)) return next();
  // req.user is populated by authMiddleware above for valid sessions only.
  // Unknown / forged / expired sids land here as undefined, so attackers can
  // never trigger the 8 MB parser without a real DB-backed session.
  const parser = req.user ? authedJson : anonJson;
  return parser(req, res, next);
});
app.use("/api", express.urlencoded({ extended: true }));

// Rate limiting — additive guards, not changing route logic. Order matters:
// the most specific limiters (AI, admin, auth) MUST be registered before the
// general /api limiter so express-rate-limit applies them first.
app.use("/api/chat", aiRateLimiter);
app.use("/api/ai", aiRateLimiter);
app.use("/api/health-search", aiRateLimiter);
// Scope the AI demo limiter to ONLY the AI demo endpoint. Mounting it on
// the whole `/api/public` prefix would also throttle unrelated public read
// routes (e.g. /api/public/communities, /api/public/posts/...), causing
// signed-out visitors to hit a misleading "Too many demo questions" 429.
app.use("/api/public/ask", publicAiRateLimiter);
app.use("/api/admin", adminRateLimiter);
app.use("/api/auth", authRateLimiter);
app.use("/api", generalRateLimiter);

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const staticDir = process.env.STATIC_DIR ?? path.resolve(process.cwd(), "artifacts/askhealth/dist/public");
  const indexHtml = path.join(staticDir, "index.html");

  if (existsSync(indexHtml)) {
    app.use(express.static(staticDir, { index: false, maxAge: "1h" }));

    app.use((req, res, next) => {
      if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) {
        return next();
      }

      res.sendFile(indexHtml);
    });
  } else {
    logger.warn({ staticDir }, "Production static frontend directory was not found");
  }
}

// Convert body-parser errors (PayloadTooLargeError, malformed JSON) into
// consistent JSON responses instead of Express's default HTML error page.
// This matches the rest of the API surface so frontend code can rely on
// `await res.json().error` everywhere.
const bodyParserErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  // express.json sets err.type for parser-originated errors.
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.too.large") {
    res.status(413).json({
      error: "payload_too_large",
      message: "Request body is too large.",
    });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({
      error: "invalid_json",
      message: "Request body is not valid JSON.",
    });
    return;
  }
  next(err);
};
app.use(bodyParserErrorHandler);

export default app;
