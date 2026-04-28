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
app.use(express.json());
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
