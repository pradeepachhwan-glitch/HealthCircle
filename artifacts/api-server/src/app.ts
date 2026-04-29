import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalRateLimiter, aiRateLimiter, adminRateLimiter, authRateLimiter, publicAiRateLimiter } from "./middleware/rateLimiter";

const app: Express = express();

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
// Skip the default JSON body parser for /api/uploads/inline so that route's
// own express.json({ limit: "8mb" }) middleware can handle the larger
// base64-encoded image payload. Without this skip the global default (~100 KB)
// runs first and rejects every real image upload with HTTP 413 before the
// per-route override gets a chance.
//
// Match is intentionally lenient — we strip a single trailing slash and lower-
// case the pathname so that /api/uploads/inline, /api/uploads/inline/, and
// /API/Uploads/Inline (some proxies normalise case) all reach the per-route
// 8 MB parser instead of silently regressing to the 100 KB default.
const UPLOAD_INLINE_PATHS = new Set([
  "/api/uploads/inline",
]);
app.use((req, res, next) => {
  const normalised = req.path.replace(/\/+$/, "").toLowerCase();
  if (UPLOAD_INLINE_PATHS.has(normalised)) return next();
  return express.json()(req, res, next);
});
app.use(express.urlencoded({ extended: true }));

app.use(authMiddleware);

// Rate limiting — additive guards, not changing route logic. Order matters:
// the most specific limiters (AI, admin, auth) MUST be registered before the
// general /api limiter so express-rate-limit applies them first.
app.use("/api/chat", aiRateLimiter);
app.use("/api/ai", aiRateLimiter);
app.use("/api/health-search", aiRateLimiter);
app.use("/api/public", publicAiRateLimiter);
app.use("/api/admin", adminRateLimiter);
app.use("/api/auth", authRateLimiter);
app.use("/api", generalRateLimiter);

app.use("/api", router);

export default app;
